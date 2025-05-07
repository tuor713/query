/**
 * Service for handling SQL queries and execution
 */
export class QueryService {
    constructor(baseUrl = 'http://localhost:8888') {
        this.baseUrl = baseUrl;
    }

    /**
     * Execute a query with optional user credentials
     */
    async executeQuery(query, limit, username, password, environment = 'local') {
        // Check if query is a special command that should not have LIMIT applied
        const trimmedQuery = query.trim().toUpperCase();
        const isShowCommand = trimmedQuery.startsWith('SHOW ');
        const isDescribeCommand = trimmedQuery.startsWith('DESCRIBE ');
        
        // Don't apply LIMIT to SHOW and DESCRIBE commands
        const finalQuery = isShowCommand || isDescribeCommand 
            ? query 
            : `SELECT * FROM (\n${query}\n) LIMIT ${limit}`;

        const response = await fetch(`${this.baseUrl}/trino`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: finalQuery,
                user: username,
                password: password,
                environment: environment,
            }),
        });

        if (response.ok) {
            return {
                success: true,
                data: await response.arrayBuffer()
            };
        } else {
            const errorData = await response.json();
            return {
                success: false,
                error: errorData.error
            };
        }
    }
}