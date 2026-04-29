from typing import Any

from pydantic import BaseModel


class IndexRequest(BaseModel):
    document_id: str


class SearchQuery(BaseModel):
    query: str
    limit: int = 5


class SearchResult(BaseModel):
    document_id: str
    document_title: str
    chunk_index: int
    chunk_text: str
    score: float
    content_json: dict[str, Any]

