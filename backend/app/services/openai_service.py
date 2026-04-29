from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import get_settings


WRITING_SYSTEM_PROMPT = (
    "You are NoteFlow's inline writing assistant. Improve writing in context, preserve the user's intent, "
    "avoid invented facts, and return only the requested prose without markdown fences unless the user asks."
)


class OpenAIService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key) if self.settings.openai_api_key else None

    async def stream_suggestion(
        self, text: str, instruction: str, document_title: str | None = None, surrounding_text: str = ""
    ) -> AsyncGenerator[str, None]:
        if not self.client:
            fallback = self._fallback_text(text, instruction)
            for token in fallback.split(" "):
                yield token + " "
            return

        context = f"Document title: {document_title or 'Untitled'}\nSurrounding text:\n{surrounding_text}\nSelected text:\n{text}"
        stream = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            stream=True,
            temperature=0.5,
            messages=[
                {"role": "system", "content": WRITING_SYSTEM_PROMPT},
                {"role": "user", "content": f"Instruction: {instruction}\n\n{context}"},
            ],
        )
        async for event in stream:
            delta = event.choices[0].delta.content
            if delta:
                yield delta

    async def complete_text(self, instruction: str, text: str) -> str:
        if not self.client:
            return self._fallback_text(text, instruction)

        response = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            temperature=0.4,
            messages=[
                {"role": "system", "content": WRITING_SYSTEM_PROMPT},
                {"role": "user", "content": f"{instruction}\n\n{text}"},
            ],
        )
        return response.choices[0].message.content or ""

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self.client:
            return [self._deterministic_embedding(text) for text in texts]

        response = await self.client.embeddings.create(model=self.settings.openai_embedding_model, input=texts)
        return [item.embedding for item in response.data]

    def _fallback_text(self, text: str, instruction: str) -> str:
        source = text.strip() or "Start writing your next idea with clarity and momentum."
        return f"{source} ({instruction.lower()} draft generated locally; configure OPENAI_API_KEY for GPT-4o output.)"

    def _deterministic_embedding(self, text: str) -> list[float]:
        values = [0.0] * 1536
        for index, byte in enumerate(text.encode("utf-8")):
            values[index % 1536] += (byte % 31) / 31
        norm = sum(v * v for v in values) ** 0.5 or 1.0
        return [v / norm for v in values]


openai_service = OpenAIService()

