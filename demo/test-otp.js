const http = require('http');

function testOTP() {
    console.log('Testing OTP functionality...\n');
    
    // Test 1: Request OTP for worker registration
    const postData = JSON.stringify({
        username: 'testworker',
        email: 'test@example.com',
        phone: '1234567890',
        password: 'password123',
        role: 'worker',
        aadhaarNumber: '123456789012',
        address: JSON.stringify({
            street: 'Test Street',
            city: 'Test City',
            state: 'Test State',
            pincode: '123456'
        }),
        location: JSON.stringify({
            link: 'https://maps.google.com/?q=20.5937,78.9629',
            latitude: 20.5937,
            longitude: 78.9629
        })
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
            body += chunk;
        });
        res.on('end', () => {
            try {
                const response = JSON.parse(body);
                console.log('OTP Request Response:');
                console.log(`Status: ${res.statusCode}`);
                console.log(`Message: ${response.message}`);
                if (response.otp) {
                    console.log(`OTP Generated: ${response.otp}`);
                    
                    // Test 2: Verify OTP
                    console.log('\nTesting OTP verification...');
                    const verifyData = JSON.stringify({
                        username: 'testworker',
                        email: 'test@example.com',
                        phone: '1234567890',
                        password: 'password123',
                        role: 'worker',
                        aadhaarNumber: '123456789012',
                        address: JSON.stringify({
                            street: 'Test Street',
                            city: 'Test City',
                            state: 'Test State',
                            pincode: '123456'
                        }),
                        location: JSON.stringify({
                            link: 'https://maps.google.com/?q=20.5937,78.9629',
                            latitude: 20.5937,
                            longitude: 78.9629
                        }),
                        otp: response.otp
                    });

                    const verifyOptions = {
                        hostname: 'localhost',
                        port: 3000,
                        path: '/api/register',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(verifyData)
                        }
                    };

                    const verifyReq = http.request(verifyOptions, (verifyRes) => {
                        let verifyBody = '';
                        verifyRes.on('data', (chunk) => {
                            verifyBody += chunk;
                        });
                        verifyRes.on('end', () => {
                            try {
                                const verifyResponse = JSON.parse(verifyBody);
                                console.log('OTP Verification Response:');
                                console.log(`Status: ${verifyRes.statusCode}`);
                                console.log(`Message: ${verifyResponse.message}`);
                                if (verifyResponse.user) {
                                    console.log('✅ User registered successfully!');
                                    console.log(`User ID: ${verifyResponse.user.id}`);
                                    console.log(`Username: ${verifyResponse.user.username}`);
                                    console.log(`Location: ${verifyResponse.user.location ? verifyResponse.user.location.link : 'None'}`);
                                }
                            } catch (e) {
                                console.log('Error parsing verification response:', e.message);
                            }
                        });
                    });

                    verifyReq.on('error', (err) => {
                        console.error('Error verifying OTP:', err.message);
                    });

                    verifyReq.write(verifyData);
                    verifyReq.end();
                }
            } catch (e) {
                console.log('Error parsing response:', e.message);
                console.log('Raw response:', body);
            }
        });
    });

    req.on('error', (err) => {
        console.error('Error requesting OTP:', err.message);
    });

    req.write(postData);
    req.end();
}

testOTP(); 