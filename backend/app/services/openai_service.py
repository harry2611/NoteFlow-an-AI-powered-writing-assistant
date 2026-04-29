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
        source = " ".join((text or "").split())
        instruction_key = instruction.lower()
        if not source:
            source = "This draft is ready for a clearer next idea."

        if "brainstorm" in instruction_key or "ideas" in instruction_key:
            return (
                "Five promising directions:\n"
                "1. Clarify the main outcome the reader should remember.\n"
                "2. Add one concrete example or detail to make the point feel real.\n"
                "3. Explain why this matters now.\n"
                "4. Turn the next step into a crisp action.\n"
                "5. Close with a memorable sentence that ties the idea back to the document."
            )

        if "continue" in instruction_key:
            return (
                f"{source} From here, the next section can build on the idea with a specific example, "
                "then connect it back to the larger purpose of the document. A strong follow-up would make the reader feel guided, not rushed."
            )

        if "shorter" in instruction_key or "concise" in instruction_key or "sharper" in instruction_key:
            words = source.split()
            shortened = " ".join(words[: min(len(words), 22)])
            return shortened.rstrip(".,;:") + "."

        if "formal" in instruction_key or "professional" in instruction_key:
            return (
                "A more polished version: "
                + source[:1].upper()
                + source[1:]
                + " This framing presents the point clearly while maintaining a professional and considered tone."
            )

        if "warm" in instruction_key or "human" in instruction_key:
            return (
                "A warmer version: "
                + source
                + " The idea feels strongest when it sounds clear, direct, and a little more personal."
            )

        if "summarize" in instruction_key or "summary" in instruction_key:
            return f"Summary: {source[:220].rstrip()}."

        if "grammar" in instruction_key or "spelling" in instruction_key or "punctuation" in instruction_key:
            cleaned = source[:1].upper() + source[1:]
            if cleaned[-1:] not in ".!?":
                cleaned += "."
            return cleaned

        if "fresh version" in instruction_key or "different wording" in instruction_key:
            return (
                "Here is a fresh take: "
                + source
                + " The revised version should feel smoother, more specific, and easier to keep reading."
            )

        return (
            "Suggested rewrite: "
            + source
            + " This version keeps the original intent while improving clarity, rhythm, and readability."
        )

    def _deterministic_embedding(self, text: str) -> list[float]:
        values = [0.0] * 1536
        for index, byte in enumerate(text.encode("utf-8")):
            values[index % 1536] += (byte % 31) / 31
        norm = sum(v * v for v in values) ** 0.5 or 1.0
        return [v / norm for v in values]


openai_service = OpenAIService()
