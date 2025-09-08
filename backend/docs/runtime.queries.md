The table `system.runtime.queries` contains information about current and recent Trino queries.

Schema:
+-----------------+---------------------------+
|Column           |Type                       |
+-----------------+---------------------------+
|query_id         |varchar                    |
|state            |varchar                    |
|user             |varchar                    |
|source           |varchar                    |
|query            |varchar                    |
|resource_group_id|array(varchar)             |
|queued_time_ms   |bigint                     |
|analysis_time_ms |bigint                     |
|planning_time_ms |bigint                     |
|created          |timestamp(3) with time zone|
|started          |timestamp(3) with time zone|
|last_heartbeat   |timestamp(3) with time zone|
|end              |timestamp(3) with time zone|
|error_type       |varchar                    |
|error_code       |varchar                    |
+-----------------+---------------------------+
