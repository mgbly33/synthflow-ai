from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any


@dataclass
class ApprovalDecision:
    approved: bool
    edited_output: str | None = None
    comment: str = ""


class ApprovalGateRegistry:
    """In-memory async registry managing live Human-in-the-Loop (HITL) approval gates."""

    def __init__(self) -> None:
        self._events: dict[str, asyncio.Event] = {}
        self._decisions: dict[str, ApprovalDecision] = {}

    @staticmethod
    def _key(run_id: str, node_id: str) -> str:
        return f"{run_id}:{node_id}"

    def register(self, run_id: str, node_id: str) -> asyncio.Event:
        key = self._key(run_id, node_id)
        evt = asyncio.Event()
        self._events[key] = evt
        self._decisions.pop(key, None)
        return evt

    def resolve(
        self,
        run_id: str,
        node_id: str,
        *,
        approved: bool,
        edited_output: str | None = None,
        comment: str = "",
    ) -> bool:
        key = self._key(run_id, node_id)
        evt = self._events.get(key)
        if evt is None:
            return False
        self._decisions[key] = ApprovalDecision(
            approved=approved,
            edited_output=edited_output,
            comment=comment,
        )
        evt.set()
        return True

    async def wait_for_decision(
        self,
        run_id: str,
        node_id: str,
        timeout_sec: float = 300.0,
    ) -> ApprovalDecision:
        key = self._key(run_id, node_id)
        evt = self._events.get(key)
        if evt is None:
            return ApprovalDecision(approved=True)
        try:
            await asyncio.wait_for(evt.wait(), timeout=timeout_sec)
            return self._decisions.pop(key, ApprovalDecision(approved=True))
        finally:
            self._events.pop(key, None)

    def cancel_run(self, run_id: str) -> int:
        prefix = f"{run_id}:"
        keys = [k for k in list(self._events.keys()) if k.startswith(prefix)]
        for k in keys:
            self._decisions[k] = ApprovalDecision(
                approved=False, comment="Execution cancelled by client"
            )
            evt = self._events.get(k)
            if evt:
                evt.set()
        return len(keys)

    def pending_keys(self) -> list[str]:
        return list(self._events.keys())


approval_registry = ApprovalGateRegistry()
