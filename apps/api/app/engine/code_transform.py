from __future__ import annotations

import ast
import json
import operator as op
import re
from typing import Any


class SafeCodeError(ValueError):
    """Raised when a Code/Transform node encounters unsafe or invalid expressions."""


_SAFE_BINOPS = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.Div: op.truediv,
    ast.FloorDiv: op.floordiv,
    ast.Mod: op.mod,
    ast.Pow: op.pow,
}

_SAFE_UNARYOPS = {
    ast.UAdd: op.pos,
    ast.USub: op.neg,
    ast.Not: op.not_,
}

_SAFE_CMPOPS = {
    ast.Eq: op.eq,
    ast.NotEq: op.ne,
    ast.Lt: op.lt,
    ast.LtE: op.le,
    ast.Gt: op.gt,
    ast.GtE: op.ge,
    ast.In: lambda a, b: a in b,
    ast.NotIn: lambda a, b: a not in b,
}

_SAFE_FUNCS = {
    "len": len,
    "min": min,
    "max": max,
    "sum": sum,
    "round": round,
    "abs": abs,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "sorted": sorted,
    "upper": lambda s: str(s).upper(),
    "lower": lambda s: str(s).lower(),
    "strip": lambda s: str(s).strip(),
    "word_count": lambda s: len(re.findall(r"[\u4e00-\u9fff]|[a-zA-Z0-9_]+", str(s))),
    "line_count": lambda s: len([ln for ln in str(s).splitlines() if ln.strip()]),
    "json_get": lambda raw, key, default="": (
        json.loads(raw).get(key, default) if isinstance(raw, str) else default
    ),
}


def _eval_ast(node: ast.AST, env: dict[str, Any]) -> Any:
    if isinstance(node, ast.Expression):
        return _eval_ast(node.body, env)
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        if node.id in env:
            return env[node.id]
        raise SafeCodeError(f"Unknown variable: {node.id}")
    if isinstance(node, ast.List):
        return [_eval_ast(el, env) for el in node.elts]
    if isinstance(node, ast.Tuple):
        return tuple(_eval_ast(el, env) for el in node.elts)
    if isinstance(node, ast.Dict):
        return {
            _eval_ast(k, env): _eval_ast(v, env)
            for k, v in zip(node.keys, node.values)
            if k is not None
        }
    if isinstance(node, ast.BinOp):
        fn = _SAFE_BINOPS.get(type(node.op))
        if fn is None:
            raise SafeCodeError(f"Operator not allowed: {type(node.op).__name__}")
        return fn(_eval_ast(node.left, env), _eval_ast(node.right, env))
    if isinstance(node, ast.UnaryOp):
        fn = _SAFE_UNARYOPS.get(type(node.op))
        if fn is None:
            raise SafeCodeError(f"Unary operator not allowed: {type(node.op).__name__}")
        return fn(_eval_ast(node.operand, env))
    if isinstance(node, ast.BoolOp):
        vals = [_eval_ast(v, env) for v in node.values]
        return all(vals) if isinstance(node.op, ast.And) else any(vals)
    if isinstance(node, ast.Compare):
        left = _eval_ast(node.left, env)
        for cmp_op, comparator in zip(node.ops, node.comparators):
            fn = _SAFE_CMPOPS.get(type(cmp_op))
            if fn is None:
                raise SafeCodeError(f"Comparison not allowed: {type(cmp_op).__name__}")
            right = _eval_ast(comparator, env)
            if not fn(left, right):
                return False
            left = right
        return True
    if isinstance(node, ast.IfExp):
        return _eval_ast(node.body, env) if _eval_ast(node.test, env) else _eval_ast(node.orelse, env)
    if isinstance(node, ast.Subscript):
        target = _eval_ast(node.value, env)
        idx = _eval_ast(node.slice, env)
        return target[idx]
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _SAFE_FUNCS:
            raise SafeCodeError("Only whitelisted safe helper functions are permitted")
        fn = _SAFE_FUNCS[node.func.id]
        args = [_eval_ast(a, env) for a in node.args]
        return fn(*args)
    raise SafeCodeError(f"Unsupported syntax node: {type(node).__name__}")


def execute_code_transform(
    *,
    mode: str,
    source_text: str,
    expression: str = "",
    json_path: str = "",
    regex_pattern: str = "",
    regex_replacement: str = "",
    inputs: dict[str, Any] | None = None,
) -> str:
    """Safely transform upstream text/JSON using deterministic AST-whitelisted ops."""
    m = (mode or "markdown_summary").lower()

    if m == "json_extract":
        try:
            obj = json.loads(source_text)
        except Exception as exc:
            raise SafeCodeError(f"JSON 解析失败 / Invalid JSON input: {exc}") from exc
        cur: Any = obj
        for part in [p for p in (json_path or "").split(".") if p]:
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            elif isinstance(cur, list) and part.isdigit() and int(part) < len(cur):
                cur = cur[int(part)]
            else:
                cur = None
                break
        if isinstance(cur, (dict, list)):
            return json.dumps(cur, ensure_ascii=False, indent=2)
        return "" if cur is None else str(cur)

    if m == "regex_replace":
        if not regex_pattern:
            return source_text
        return re.sub(regex_pattern, regex_replacement or "", source_text)

    if m == "expression":
        if not expression.strip():
            return source_text
        try:
            tree = ast.parse(expression.strip(), mode="eval")
        except SyntaxError as exc:
            raise SafeCodeError(f"表达式语法错误 / Expression syntax error: {exc}") from exc
        parsed_json: Any = {}
        try:
            parsed_json = json.loads(source_text)
        except Exception:
            parsed_json = {}
        env = {
            "text": source_text,
            "data": parsed_json,
            "inputs": inputs or {},
            "chars": len(source_text),
            "lines": [ln for ln in source_text.splitlines() if ln.strip()],
        }
        result = _eval_ast(tree, env)
        if isinstance(result, (dict, list)):
            return json.dumps(result, ensure_ascii=False, indent=2)
        return str(result)

    # Default: structured markdown stats & clean formatter
    clean = source_text.strip()
    words = _SAFE_FUNCS["word_count"](clean)
    lines = _SAFE_FUNCS["line_count"](clean)
    # Try parsing JSON metrics cleanly into a Markdown summary table if input is JSON
    try:
        parsed = json.loads(clean)
        if isinstance(parsed, dict):
            rows = []
            data_block = parsed.get("data") if isinstance(parsed.get("data"), dict) else parsed
            for k, v in data_block.items():
                val_str = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
                rows.append(f"| `{k}` | {val_str} |")
            if rows:
                return (
                    "### 结构化指标清洗结果（Code Transform）\n\n"
                    "| 指标字段 | 清洗值 |\n| :--- | :--- |\n"
                    + "\n".join(rows)
                )
    except Exception:
        pass

    return (
        f"### 数据清洗与结构化汇总\n\n"
        f"- **有效字符数**：`{len(clean)}` ｜ **词元估算**：`{words}` ｜ **有效行数**：`{lines}`\n\n"
        f"{clean}"
    )
