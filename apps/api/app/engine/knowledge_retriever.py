from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

_CJK_RE = re.compile(r"[\u4e00-\u9fff]+")
_EN_RE = re.compile(r"[a-zA-Z0-9_]+")
_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "are", "was", "were",
    "have", "has", "not", "but", "you", "your", "can", "will", "all", "any",
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你",
}


def tokenize_bilingual(text: str) -> list[str]:
    """Lightweight bilingual tokenizer supporting English words and Chinese bigrams + unigrams."""
    if not text:
        return []
    tokens: list[str] = []
    lowered = text.lower()

    for m in _EN_RE.findall(lowered):
        if len(m) >= 2 and m not in _STOPWORDS:
            tokens.append(m)

    for seg in _CJK_RE.findall(lowered):
        # Add individual meaningful characters and bigrams for accurate Chinese BM25 matching
        if len(seg) == 1:
            if seg not in _STOPWORDS:
                tokens.append(seg)
        else:
            for i in range(len(seg)):
                ch = seg[i]
                if ch not in _STOPWORDS:
                    tokens.append(ch)
                if i + 1 < len(seg):
                    tokens.append(seg[i : i + 2])
    return tokens


def chunk_document(content: str, max_chars: int = 360, overlap: int = 50) -> list[dict[str, Any]]:
    """Split a document into semantic paragraph-aligned chunks."""
    if not content or not content.strip():
        return []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", content.strip()) if p.strip()]
    chunks: list[dict[str, Any]] = []
    buffer = ""
    chunk_idx = 0

    def _flush(text: str) -> None:
        nonlocal chunk_idx
        clean = text.strip()
        if not clean:
            return
        chunks.append(
            {
                "index": chunk_idx,
                "text": clean,
                "char_count": len(clean),
            }
        )
        chunk_idx += 1

    for para in paragraphs:
        if len(para) > max_chars:
            if buffer:
                _flush(buffer)
                buffer = ""
            start = 0
            step = max(1, max_chars - overlap)
            while start < len(para):
                _flush(para[start : start + max_chars])
                start += step
            continue

        if not buffer:
            buffer = para
        elif len(buffer) + len(para) + 2 <= max_chars:
            buffer = f"{buffer}\n\n{para}"
        else:
            _flush(buffer)
            buffer = para

    if buffer:
        _flush(buffer)

    return chunks


def retrieve_top_k(
    query: str,
    docs: list[dict[str, Any]],
    top_k: int = 3,
    k1: float = 1.5,
    b: float = 0.75,
) -> list[dict[str, Any]]:
    """Rank chunks across documents using Okapi BM25 and return top-K matches."""
    query_tokens = tokenize_bilingual(query)
    corpus: list[dict[str, Any]] = []

    for doc in docs:
        doc_id = doc.get("id", "")
        title = doc.get("title", "Untitled")
        chunks = doc.get("chunks_json") or chunk_document(doc.get("content", ""))
        for ch in chunks:
            text = ch.get("text", "") if isinstance(ch, dict) else str(ch)
            if not text.strip():
                continue
            tokens = tokenize_bilingual(f"{title} {text}")
            corpus.append(
                {
                    "doc_id": doc_id,
                    "doc_title": title,
                    "chunk_index": ch.get("index", 0) if isinstance(ch, dict) else 0,
                    "text": text,
                    "tokens": tokens,
                    "tf": Counter(tokens),
                    "length": max(1, len(tokens)),
                }
            )

    if not corpus:
        return []

    if not query_tokens:
        return [
            {
                "doc_id": item["doc_id"],
                "doc_title": item["doc_title"],
                "chunk_index": item["chunk_index"],
                "score": 0.0,
                "text": item["text"],
            }
            for item in corpus[: max(1, top_k)]
        ]

    n_docs = len(corpus)
    avgdl = sum(item["length"] for item in corpus) / n_docs
    df: Counter[str] = Counter()
    for item in corpus:
        for tok in set(item["tokens"]):
            df[tok] += 1

    q_unique = set(query_tokens)
    scored: list[dict[str, Any]] = []

    for item in corpus:
        score = 0.0
        dl = item["length"]
        tf_map = item["tf"]
        for qt in q_unique:
            freq = tf_map.get(qt, 0)
            if freq == 0:
                continue
            doc_freq = df.get(qt, 0)
            idf = math.log(1.0 + (n_docs - doc_freq + 0.5) / (doc_freq + 0.5))
            denom = freq + k1 * (1.0 - b + b * (dl / avgdl))
            score += idf * (freq * (k1 + 1.0)) / denom

        scored.append(
            {
                "doc_id": item["doc_id"],
                "doc_title": item["doc_title"],
                "chunk_index": item["chunk_index"],
                "score": round(score, 4),
                "text": item["text"],
            }
        )

    scored.sort(key=lambda x: x["score"], reverse=True)
    # Prefer positive scores; fallback to top chunks if query had zero lexical overlap
    positive = [item for item in scored if item["score"] > 0]
    selected = positive[: max(1, top_k)] if positive else scored[: max(1, top_k)]
    return selected
