const { app } = require('@azure/functions');

const swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'Student Scheduler API',
        version: '1.0.0',
        description: 'API quản lý thời khóa biểu sinh viên - Azure Functions'
    },
    servers: [
        {
            url: process.env.API_URL || 'https://func-student-schedule-gbcpezaghachdkfn.eastasia-01.azurewebsites.net',
            description: 'Production server'
        }
    ],
    paths: {
        '/api/courses': {
            get: {
                summary: 'Lấy danh sách môn học',
                tags: ['Courses'],
                parameters: [
                    {
                        name: 'semester',
                        in: 'query',
                        schema: { type: 'string', default: '2025A' },
                        description: 'Mã học kỳ'
                    }
                ],
                responses: {
                    200: {
                        description: 'Danh sách môn học',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Course' }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/auth/login': {
            post: {
                summary: 'Đăng nhập với Microsoft',
                tags: ['Auth'],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    accessToken: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Đăng nhập thành công' }
                }
            }
        },
        '/api/health': {
            get: {
                summary: 'Kiểm tra trạng thái API',
                tags: ['Health'],
                responses: {
                    200: { description: 'API đang hoạt động' }
                }
            }
        }
    },
    components: {
        schemas: {
            Course: {
                type: 'object',
                properties: {
                    courseId: { type: 'integer' },
                    courseName: { type: 'string' },
                    courseCode: { type: 'string' },
                    credits: { type: 'integer' },
                    lecturer: { type: 'string' },
                    time: { type: 'string' },
                    room: { type: 'string' },
                    weeks: { type: 'string' },
                    quantity: { type: 'integer' }
                }
            }
        }
    }
};

const swaggerHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Student Scheduler API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/api-docs.json',
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
            layout: 'BaseLayout'
        });
    </script>
</body>
</html>`;

// Swagger UI HTML
app.http('api-docs', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api-docs',
    handler: async (request, context) => {
        return {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
            body: swaggerHtml
        };
    }
});

// Swagger JSON spec
app.http('api-docs-json', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'api-docs.json',
    handler: async (request, context) => {
        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(swaggerSpec)
        };
    }
});
