import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import pandas as pd
import pyarrow as pa
import tornado.ioloop
import tornado.web
import trino
from tornado.concurrent import run_on_executor
from trino.auth import BasicAuthentication

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

from llm_factory import UniversalLLM, get_available_functions


def convertToRows(cols, tuples):
    rows = []
    for t in tuples:
        row = {}
        for i in range(len(cols)):
            if isinstance(t[i], datetime):
                row[cols[i]] = t[i].isoformat()
            else:
                row[cols[i]] = t[i]
        rows.append(row)
    return rows


def rename_duplicate_columns(df):
    cols = {}
    newcols = []
    for i, col in enumerate(df.columns):
        if col in cols:
            newcols.append(col + "_" + str(cols[col] + 1))
            cols[col] += 1
        else:
            newcols.append(col)
            cols[col] = 1

    df.columns = newcols

    return df


def sanitize_df(df):
    df = rename_duplicate_columns(df)
    print(df)

    if len(df) <= 0:
        return df

    # Force object types to string, if they are not already
    ts = df.dtypes
    for k in ts.keys():
        if ts[k] == "object" and not isinstance(df[k][0], str):
            print(f"Forcing column {k} to string")
            df[k] = df[k].astype(str)

    return df


def readFile(filePath):
    with open(filePath, "r") as file:
        return file.read()


class TrinoArrowHandler(tornado.web.RequestHandler):
    executor = ThreadPoolExecutor(max_workers=4)

    def set_default_headers(self):
        # Allow CORS if needed
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type")
        self.set_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def options(self):
        # Handle preflight requests
        self.set_status(204)
        self.finish()

    @run_on_executor
    def execute_query_arrow(
        self, host, port, user, password, catalog, schema, query, extraCredentials
    ):
        """Execute query and return arrow bytes - runs on executor thread"""
        conn = trino.dbapi.connect(
            host=host,
            port=port,
            user=user,
            auth=BasicAuthentication(user, password)
            if password and password != ""
            else None,
            catalog=catalog,
            schema=schema,
            extra_credential=extraCredentials,
        )

        df = sanitize_df(pd.read_sql(query, conn))

        # Convert DataFrame to Arrow Table
        table = pa.Table.from_pandas(df)
        print(f"Arrow schema {table.schema}")

        # Serialize to Arrow IPC format
        sink = pa.BufferOutputStream()
        writer = pa.ipc.new_stream(sink, table.schema)
        writer.write_table(table)
        writer.close()
        arrow_bytes = sink.getvalue().to_pybytes()

        return arrow_bytes

    @run_on_executor
    def execute_query_json(
        self, host, port, user, password, catalog, schema, query, extraCredentials
    ):
        """Execute query and return JSON data - runs on executor thread"""
        conn = trino.dbapi.connect(
            host=host,
            port=port,
            user=user,
            auth=BasicAuthentication(user, password)
            if password and password != ""
            else None,
            catalog=catalog,
            schema=schema,
            extra_credential=extraCredentials,
        )

        cur = conn.cursor()
        cur.execute(query)
        columns = [cd.name for cd in cur.description]

        return {
            "columns": columns,
            "types": [cd.type_code for cd in cur.description],
            "query": query,
            "rows": convertToRows(columns, cur.fetchall()),
            "error": None,
            "connectionTested": True,
        }

    async def post(self):
        try:
            # Parse request body as JSON
            request_data = json.loads(self.request.body)

            # Extract query and connection parameters
            query = request_data.get("query")
            if not query:
                raise ValueError("Missing required 'query' parameter")

            # Optional connection parameters with defaults
            host = request_data.get("host", "localhost")
            port = request_data.get("port", 8080)
            user = request_data.get("user", "admin")
            password = request_data.get("password", None)
            catalog = request_data.get("catalog", "default")
            schema = request_data.get("schema", "default")
            format = request_data.get("format", "arrow")

            extraCredentials = request_data.get("extraCredentials", None)
            tuplifiedExtraCredentials = None
            if extraCredentials is not None:
                tuplifiedExtraCredentials = []
                for cred in extraCredentials:
                    tuplifiedExtraCredentials.append((cred[0], cred[1]))

            logger.info(f"Serving query: {query} from user {user} with format {format}")

            if format == "arrow":
                arrow_bytes = await self.execute_query_arrow(
                    host,
                    port,
                    user,
                    password,
                    catalog,
                    schema,
                    query,
                    tuplifiedExtraCredentials,
                )

                # Set appropriate headers and return the Arrow IPC bytes
                self.set_header("Content-Type", "application/octet-stream")
                self.write(arrow_bytes)
            elif format == "json":
                json_data = await self.execute_query_json(
                    host,
                    port,
                    user,
                    password,
                    catalog,
                    schema,
                    query,
                    tuplifiedExtraCredentials,
                )

                self.set_header("Content-Type", "application/json")
                self.write(json_data)

        except Exception as e:
            logger.error(e)
            self.set_status(500)
            self.write({"error": str(e)})


class SearchHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type")
        self.set_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def options(self):
        self.set_status(204)
        self.finish()

    async def post(self):
        try:
            request_data = json.loads(self.request.body)
            query = request_data.get("query", "")

            logger.info(f"Search request: {query}")

            # Sample implementation with hard coded results
            sample_yaml = readFile("docs/search.yml")

            self.set_header("Content-Type", "text/yaml")
            self.write(sample_yaml)

        except Exception as e:
            logger.error(f"Search error: {e}")
            self.set_status(500)
            self.write({"error": str(e)})


class RetrieveDocHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type")
        self.set_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def options(self):
        self.set_status(204)
        self.finish()

    async def post(self):
        try:
            request_data = json.loads(self.request.body)
            doc_id = request_data.get("doc_id", "unknown")

            logger.info(f"Retrieve document request: {doc_id}")

            fileContents = readFile("docs/" + doc_id)
            sample_content = f"""Document: {doc_id}\n\n{fileContents}"""

            self.set_header("Content-Type", "text/plain")
            self.write(sample_content)

        except Exception as e:
            logger.error(f"Retrieve doc error: {e}")
            self.set_status(500)
            self.write({"error": str(e)})


class AIHandler(tornado.web.RequestHandler):
    executor = ThreadPoolExecutor(max_workers=4)

    def initialize(self):
        pass

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type")
        self.set_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def options(self):
        self.set_status(204)
        self.finish()

    @run_on_executor
    def execute_chat_completion(self, messages, functions, model=None):
        """Execute chat completion - runs on executor thread"""
        kwargs = {}
        if model:
            kwargs["model"] = model
        llm = UniversalLLM(provider="ollama", **kwargs)
        logger.info(
            f"Using LLM provider: {llm.get_provider()}, model: {llm.get_model_name()}"
        )
        return llm.chat_complete(messages, functions)

    async def post(self):
        try:
            request_data = json.loads(self.request.body)

            # Extract required parameters
            messages = request_data.get("messages", [])
            model = request_data.get("model", None)

            logger.info(f"Chat completion request with model={model}: {messages}")

            if not messages:
                raise ValueError("Missing required 'messages' parameter")

            # Get available functions
            functions = get_available_functions()

            # Call LLM with functions (now runs on executor)
            llm_response = await self.execute_chat_completion(
                messages, functions, model
            )

            if not llm_response.get("success"):
                self.set_status(500)
                self.write({"error": llm_response.get("error", "Unknown LLM error")})
                return

            response_data = {
                "text": llm_response.get("text", ""),
                "model": llm_response.get("model", "unknown"),
                "function_call": llm_response.get("function_call"),
            }

            logger.info(f"Chat completion response: {response_data}")

            self.set_header("Content-Type", "application/json")
            self.write(response_data)

        except Exception as e:
            print(f"AI Handler error: {e}")
            self.set_status(500)
            self.write({"error": str(e)})


# Load UI config from config.json (once at startup)
_config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
try:
    with open(_config_path, "r") as f:
        _ui_config = json.load(f)
    logger.info(f"Loaded UI config from {_config_path}")
except Exception as e:
    logger.warning(f"Could not load config.json ({e}), using defaults")
    _ui_config = {
        "disclaimer": "DISCLAIMER — AI can make mistakes, always check the results.",
        "environments": [{"id": "local", "name": "Local", "cluster": "local"}],
        "defaultEnvironment": "local",
        "models": [{"id": "gpt-oss", "name": "gpt-oss"}],
        "defaultModel": "gpt-oss",
    }


class ConfigHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/json")
        self.write(_ui_config)


app = tornado.web.Application(
    [
        (r"/config", ConfigHandler),
        (r"/trino", TrinoArrowHandler),
        (r"/ai/chat", AIHandler),
        (r"/ai/search", SearchHandler),
        (r"/ai/retrieve_doc", RetrieveDocHandler),
        (
            r"/(.*)",
            tornado.web.StaticFileHandler,
            {"path": "./", "default_filename": "sql2.html"},
        ),
    ]
)


# Add CORS headers to all responses
def add_cors_headers(self):
    self.set_header("Access-Control-Allow-Origin", "*")
    self.set_header("Access-Control-Allow-Headers", "Content-Type")
    self.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")


tornado.web.RequestHandler.set_default_headers = add_cors_headers

print("Starting web server")
# Start the Tornado server
app.listen(8888)
loop = tornado.ioloop.IOLoop.current()
loop.start()
