const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            const postData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve({ status: res.statusCode, data: response });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testAPI() {
    console.log('Testing API endpoints...\n');

    try {
        // Test 1: Get all workers
        console.log('1. Testing GET /api/workers');
        const workersResponse = await makeRequest('/api/workers');
        console.log(`Status: ${workersResponse.status}`);
        if (workersResponse.status === 200) {
            const workers = workersResponse.data;
            console.log(`Found ${workers.length} workers`);
            if (workers.length > 0) {
                const worker = workers[0];
                console.log('Sample worker data:');
                console.log(`- Name: ${worker.name}`);
                console.log(`- Skills: ${worker.skills ? worker.skills.join(', ') : 'None'}`);
                console.log(`- Location: ${worker.location ? worker.location.link : 'None'}`);
                console.log(`- Address: ${worker.address ? `${worker.address.city}, ${worker.address.state}` : 'None'}`);
                console.log(`- Rating: ${worker.averageRating || 'No ratings'}`);
                console.log(`- Reviews: ${worker.reviewsCount || 0}`);
            }
        } else {
            console.log('Error:', workersResponse.data);
        }
        console.log('');

        // Test 2: Get specific worker details
        if (workersResponse.status === 200 && workersResponse.data.length > 0) {
            const workerId = workersResponse.data[0].id;
            console.log(`2. Testing GET /api/worker/${workerId}`);
            const workerResponse = await makeRequest(`/api/worker/${workerId}`);
            console.log(`Status: ${workerResponse.status}`);
            if (workerResponse.status === 200) {
                const worker = workerResponse.data;
                console.log('Worker details:');
                console.log(`- Name: ${worker.name}`);
                console.log(`- Email: ${worker.email}`);
                console.log(`- Phone: ${worker.phone}`);
                console.log(`- Experience: ${worker.experience} years`);
                console.log(`- Hourly Rate: $${worker.hourlyRate}`);
                console.log(`- Location: ${worker.location ? worker.location.link : 'None'}`);
            } else {
                console.log('Error:', workerResponse.data);
            }
            console.log('');

            // Test 3: Get worker reviews
            console.log(`3. Testing GET /api/worker/${workerId}/reviews`);
            const reviewsResponse = await makeRequest(`/api/worker/${workerId}/reviews`);
            console.log(`Status: ${reviewsResponse.status}`);
            if (reviewsResponse.status === 200) {
                const reviews = reviewsResponse.data;
                console.log(`Found ${reviews.length} reviews`);
                if (reviews.length > 0) {
                    console.log('Sample review:');
                    console.log(`- Rating: ${reviews[0].rating}/5`);
                    console.log(`- Comment: ${reviews[0].comment}`);
                }
            } else {
                console.log('Error:', reviewsResponse.data);
            }
        }

    } catch (error) {
        console.error('❌ Error testing API:', error.message);
    }
}

testAPI(); 