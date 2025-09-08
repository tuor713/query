"""
LLM Factory for creating appropriate LLM instances based on configuration
"""
from typing import Dict, List, Optional, Any
import os
from llm import OllamaLLM

class LLMFactory:
    """Factory class for creating LLM instances"""

    @staticmethod
    def create_llm(provider: str = None, **kwargs):
        """
        Create an LLM instance based on the provider

        Args:
            provider: The LLM provider to use ('ollama' or 'gemini')
            **kwargs: Additional arguments passed to the LLM constructor

        Returns:
            An instance of the appropriate LLM class

        Raises:
            ValueError: If provider is not supported or required parameters are missing
        """
        # Determine provider from environment if not specified
        if provider is None:
            provider = os.getenv('LLM_PROVIDER', 'ollama').lower()

        provider = provider.lower()

        if provider == 'ollama':
            return LLMFactory._create_ollama_llm(**kwargs)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}. Supported providers: 'ollama', 'gemini'")

    @staticmethod
    def _create_ollama_llm(**kwargs) -> OllamaLLM:
        """Create Ollama LLM instance"""
        base_url = kwargs.get('base_url') or os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        model = kwargs.get('model') or os.getenv('OLLAMA_MODEL', 'gpt-oss')

        return OllamaLLM(base_url=base_url, model=model)


class UniversalLLM:
    """
    Universal LLM wrapper that provides a consistent interface
    regardless of the underlying provider
    """

    def __init__(self, provider: str = None, **kwargs):
        """
        Initialize UniversalLLM with the specified provider

        Args:
            provider: The LLM provider to use ('ollama' or 'gemini')
            **kwargs: Additional arguments passed to the LLM constructor
        """
        self.llm = LLMFactory.create_llm(provider, **kwargs)
        self.provider = provider or os.getenv('LLM_PROVIDER', 'ollama').lower()

    def chat_complete(self, messages: List[Dict[str, str]], functions: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Send a chat completion request using the configured LLM provider

        Args:
            messages: List of message objects with 'role' and 'content'
            functions: Optional list of function definitions for function calling

        Returns:
            Dict containing the response from the LLM provider
        """
        return self.llm.chat_complete(messages, functions)

    def get_provider(self) -> str:
        """Get the current provider name"""
        return self.provider

    def get_model_name(self) -> str:
        """Get the current model name"""
        if hasattr(self.llm, 'model'):
            return self.llm.model
        elif hasattr(self.llm, 'model_name'):
            return self.llm.model_name
        else:
            return "unknown"


def get_available_functions() -> List[Dict]:
    """Return list of available functions for the AI (common to all providers)"""
    return [
        {
            "name": "execute_sql_query",
            "description": "Execute a SQL query against the Trino database and return results. Will return full results for schema data queries (SHOW, DESCRIBE) and otherwise result metadata only.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The SQL query to execute. Do not include a trailing ';' at the end of the query."
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "search",
            "description": "Search for dataset documentation and sample queries. Returns YAML of ranked results.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search to execute."
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "retrieve_doc",
            "description": "Retrieve documentation by document id using document ids from the `search` function.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_id": {
                        "type": "string",
                        "description": "The document id to retrieve."
                    }
                },
                "required": ["doc_id"]
            }
        },
        {
            "name": "execute_malloy",
            "description": "Execute a Malloy query against the database. Will return result metadata only.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The Malloy query to execute."
                    }
                },
                "required": ["query"]
            }
        }
    ]
