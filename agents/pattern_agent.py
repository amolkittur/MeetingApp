import openai
import aiofiles
from dotenv import load_dotenv
import os
import asyncio
from typing import List

load_dotenv()


class PatternAgent:
    def __init__(self, transcript: str, patterns: list[str]):
        self.transcript = transcript
        self.patterns = patterns
        self.client = openai.AsyncOpenAI()

    async def __get_prompt(self, pattern: str) -> str:
        prompt_path = f"patterns/create_{pattern}.md"
        async with aiofiles.open(prompt_path, mode="r") as file:
            return await file.read()
        

    async def _process_pattern(self, pattern: str) -> dict:
        prompt = await self.__get_prompt(pattern)
        response = await self.client.chat.completions.create(
            model= os.getenv("OPENAI_MODEL_NAME"),
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": self.transcript},
            ],
        )
        return {
            "pattern": pattern,
            "response": response.choices[0].message.content,
        }
    
    async def process_patterns(self) -> List[dict]:
        tasks = [
            self._process_pattern(pattern) for pattern in self.patterns
        ]
        return await asyncio.gather(*tasks)