from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.engine.knowledge_retriever import chunk_document, retrieve_top_k
from app.models.models import KnowledgeDoc
from app.schemas.schemas import (
    KnowledgeDocCreate,
    KnowledgeDocResponse,
    KnowledgeDocUpdate,
    KnowledgeSearchMatch,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("", response_model=list[KnowledgeDocResponse])
async def list_knowledge_docs(db: AsyncSession = Depends(get_db)) -> list[KnowledgeDoc]:
    res = await db.execute(select(KnowledgeDoc).order_by(KnowledgeDoc.updated_at.desc()))
    return list(res.scalars().all())


@router.post("", response_model=KnowledgeDocResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_doc(
    payload: KnowledgeDocCreate, db: AsyncSession = Depends(get_db)
) -> KnowledgeDoc:
    doc = KnowledgeDoc(
        id=f"kb-{uuid.uuid4().hex[:10]}",
        title=payload.title.strip(),
        content=payload.content,
        chunks_json=chunk_document(payload.content),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.put("/{doc_id}", response_model=KnowledgeDocResponse)
async def update_knowledge_doc(
    doc_id: str, payload: KnowledgeDocUpdate, db: AsyncSession = Depends(get_db)
) -> KnowledgeDoc:
    doc = await db.get(KnowledgeDoc, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Knowledge document not found")
    if payload.title is not None:
        doc.title = payload.title.strip()
    if payload.content is not None:
        doc.content = payload.content
        doc.chunks_json = chunk_document(payload.content)
    doc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_doc(doc_id: str, db: AsyncSession = Depends(get_db)) -> None:
    doc = await db.get(KnowledgeDoc, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Knowledge document not found")
    await db.delete(doc)
    await db.commit()


@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge_bm25(
    payload: KnowledgeSearchRequest, db: AsyncSession = Depends(get_db)
) -> KnowledgeSearchResponse:
    rows = list((await db.execute(select(KnowledgeDoc))).scalars().all())
    doc_filter = set(payload.doc_ids or [])
    docs = [
        {
            "id": d.id,
            "title": d.title,
            "content": d.content,
            "chunks_json": d.chunks_json,
        }
        for d in rows
        if not doc_filter or d.id in doc_filter
    ]
    matches = retrieve_top_k(payload.query, docs, top_k=payload.top_k)
    return KnowledgeSearchResponse(
        query=payload.query,
        total_matches=len(matches),
        matches=[KnowledgeSearchMatch(**m) for m in matches],
    )
