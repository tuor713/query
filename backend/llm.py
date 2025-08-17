"""
LLM utility module for Ollama-based AI chat functionality
"""
from typing import Dict, List, Optional, Any
import ollama


class OllamaLLM:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "gpt-oss"):
        """
        Initialize OllamaLLM with Ollama Python client

        Args:
            base_url: The base URL for the Ollama server
            model: The model name to use for chat completions
        """
        self.client = ollama.Client(host=base_url)
        self.model = model

    def chat_complete(self, messages: List[Dict[str, str]], functions: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Send a chat completion request to Ollama

        Args:
            messages: List of message objects with 'role' and 'content'
            functions: Optional list of function definitions for function calling

        Returns:
            Dict containing the response from Ollama
        """
        try:
            # Prepare the chat request parameters
            chat_params = {
                "model": self.model,
                "messages": messages,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                }
            }

            # Convert functions to Ollama tools format if provided
            if functions:
                tools = self._convert_functions_to_tools(functions)
                chat_params["tools"] = tools

            # Send chat request using Ollama client
            response = self.client.chat(**chat_params)

            # Extract the response
            message = response.get("message", {})
            response_text = message.get("content", "")

            # Check for tool calls in the response
            tool_calls = message.get("tool_calls", [])
            function_call = None

            if tool_calls:
                # Convert the first tool call to our expected format
                # (maintaining backward compatibility with existing code)
                first_call = tool_calls[0]
                function_call = {
                    "name": first_call.get("function", {}).get("name"),
                    "arguments": first_call.get("function", {}).get("arguments", {})
                }

            return {
                "success": True,
                "response": response_text,
                "function_call": function_call,
                "model": self.model,
                "raw_message": message  # Include full message for debugging
            }

        except ollama.ResponseError as e:
            return {
                "success": False,
                "error": f"Ollama API error: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }

    def _convert_functions_to_tools(self, functions: List[Dict]) -> List[Dict]:
        """
        Convert function definitions to Ollama tools format

        Args:
            functions: List of function definitions in simplified format

        Returns:
            List of tools in Ollama's expected format
        """
        tools = []

        for func in functions:
            tool = {
                "type": "function",
                "function": {
                    "name": func.get("name"),
                    "description": func.get("description", ""),
                }
            }

            # Add parameters if they exist
            if "parameters" in func:
                params = func["parameters"]

                # Ensure parameters follow the correct schema
                if isinstance(params, dict):
                    # If it already has the correct structure, use it
                    if "type" not in params:
                        params["type"] = "object"

                    tool["function"]["parameters"] = params

            tools.append(tool)

        return tools
