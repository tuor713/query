import tornado.web
import tornado.ioloop
from tornado.concurrent import run_on_executor
from concurrent.futures import ThreadPoolExecutor

from datetime import datetime
import pandas as pd
import pyarrow as pa
import trino
from trino.auth import BasicAuthentication
import json

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
    def execute_query_arrow(self, host, port, user, password, catalog, schema, query, extraCredentials):
        """Execute query and return arrow bytes - runs on executor thread"""
        conn = trino.dbapi.connect(
            host=host,
            port=port,
            user=user,
            auth=BasicAuthentication(user, password) if password and password != "" else None,
            catalog=catalog,
            schema=schema,
            extra_credential=extraCredentials
        )

        df = pd.read_sql(query, conn)

        # Convert DataFrame to Arrow Table
        table = pa.Table.from_pandas(df)

        # Serialize to Arrow IPC format
        sink = pa.BufferOutputStream()
        writer = pa.ipc.new_stream(sink, table.schema)
        writer.write_table(table)
        writer.close()
        arrow_bytes = sink.getvalue().to_pybytes()

        return arrow_bytes

    @run_on_executor
    def execute_query_json(self, host, port, user, password, catalog, schema, query, extraCredentials):
        """Execute query and return JSON data - runs on executor thread"""
        conn = trino.dbapi.connect(
            host=host,
            port=port,
            user=user,
            auth=BasicAuthentication(user, password) if password and password != "" else None,
            catalog=catalog,
            schema=schema,
            extra_credential=extraCredentials
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
            "connectionTested": True
        }

    async def post(self):
        try:
            # Parse request body as JSON
            request_data = json.loads(self.request.body)

            # Extract query and connection parameters
            query = request_data.get('query')
            if not query:
                raise ValueError("Missing required 'query' parameter")

            # Optional connection parameters with defaults
            host = request_data.get('host', 'localhost')
            port = request_data.get('port', 8080)
            user = request_data.get('user','admin')
            password = request_data.get('password', None)
            catalog = request_data.get('catalog', 'default')
            schema = request_data.get('schema', 'default')
            format = request_data.get('format', 'arrow')

            extraCredentials = request_data.get('extraCredentials', None)
            tuplifiedExtraCredentials = None
            if extraCredentials is not None:
                tuplifiedExtraCredentials = []
                for cred in extraCredentials:
                    tuplifiedExtraCredentials.append((cred[0], cred[1]))

            print(f"Serving query: {query} from user {user} with format {format}")

            if format == 'arrow':
                arrow_bytes = await self.execute_query_arrow(
                    host, port, user, password, catalog, schema, query, tuplifiedExtraCredentials
                )

                # Set appropriate headers and return the Arrow IPC bytes
                self.set_header('Content-Type', 'application/octet-stream')
                self.write(arrow_bytes)
            elif format == 'json':
                json_data = await self.execute_query_json(
                    host, port, user, password, catalog, schema, query, tuplifiedExtraCredentials
                )

                self.set_header('Content-Type', 'application/json')
                self.write(json_data)

        except Exception as e:
            print(e)
            self.set_status(500)
            self.write({"error": str(e)})

app = tornado.web.Application([
    (r"/trino", TrinoArrowHandler),
    (r"/(.*)", tornado.web.StaticFileHandler, {"path":"./", "default_filename":"sql2.html"}),
])

# Add CORS headers to all responses
def add_cors_headers(self):
    self.set_header("Access-Control-Allow-Origin", "*")
    self.set_header("Access-Control-Allow-Headers", "Content-Type")
    self.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

tornado.web.RequestHandler.set_default_headers = add_cors_headers

print('Starting web server')
# Start the Tornado server
app.listen(8888)
loop = tornado.ioloop.IOLoop.current()
loop.start()
