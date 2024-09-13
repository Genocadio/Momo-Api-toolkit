const express = require('express');
const axios = require('axios');
require('dotenv').config();
const cors = require('cors');
const fs = require('fs');
const path = require('path')
const { v4: uuidv4 } = require('uuid'); // Import the uuid library

const app = express();
app.use(express.json());
app.use(cors());

// Endpoint to handle payment requests
app.post('/api/request-payment', async (req, res) => {
    const { amount, phoneNumber } = req.body;

    try {
        const referenceId = uuidv4(); // Generate a new UUID v4

        // Log the incoming request data and generated reference ID
        console.log('Incoming request data:', { amount, phoneNumber });
        console.log('Generated Reference ID:', referenceId);

        // Log the complete request payload
        const requestPayload = {
            amount,
            currency: 'EUR',
            externalId: '000304335', // Example value from the curl command
            payer: {
                partyIdType: 'MSISDN',
                partyId: phoneNumber
            },
            payerMessage: 'MoMo Market Payment', // Example value from the curl command
            payeeNote: 'MoMo Market Payment' // Example value from the curl command
        };
        console.log('Request Payload:', JSON.stringify(requestPayload, null, 2));

        // Make the request to MTN MoMo API
        const response = await axios.post('https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay', requestPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'X-Reference-Id': referenceId, // Use the dynamically generated UUID here
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY, // Ensure this matches the provided subscription key
                'Content-Type': 'application/json',
                'X-Target-Environment': 'sandbox', // Ensure this matches the target environment
                'X-Callback-Url': `http://${process.env.CALLBACK_URL}/callback` // Set callback URL here (commented out for debugging)
            }
        });

        // Log the response from the MTN MoMo API
        console.log('Response from MTN MoMo API:', JSON.stringify(response.data, null, 2), process.env.REQUIRE_INSTANT_PAY, response.status);

        if(process.env.REQUIRE_INSTANT_PAY ===  'true' && response.status === 202) {
            console.log('testing  payment');

            try {
                // Additional request to check payment status
                const response2 = await axios.get(`https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${referenceId}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                        'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                        'X-Target-Environment': 'sandbox'
                    }
                });

                console.log('Additional Response from MTN MoMo API:', JSON.stringify(response2.data, null, 2));

                // Send the additional response data to the client
                res.status(response2.status).json({...response2.data, referenceId: referenceId});
            } catch (error) {
                console.error('Error in additional request:', {
                    message: error.message,
                    response: error.response ? {
                        status: error.response.status,
                        data: error.response.data
                    } : null
                });

                const statusCode = error.response ? error.response.status : 500;
                const errorMessage = error.response ? error.response.data : 'Failed to check payment status';
                res.status(statusCode).send(errorMessage);
            }
        } else {
            
            // Send the same status code and response data to the client
            res.status(response.status).json({...response.data, referenceId: referenceId});

        }


    } catch (error) {
        // Log detailed error information
        console.error('Error in request payment:', {
            message: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });

        // If the error response exists, send that status and data, otherwise send 500
        const statusCode = error.response ? error.response.status : 500;
        const errorMessage = error.response ? error.response.data : 'Payment request failed';
        res.status(statusCode).send(errorMessage);
    }
});


app.get('/api/payment-status/:referenceId', async (req, res) => {
    const { referenceId } = req.params;

    try {
        // Log the referenceId for debugging purposes
        console.log('Checking payment status for Reference ID:', referenceId);

        // Make the request to MTN MoMo API to check payment status
        const response = await axios.get(`https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${referenceId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY, // Ensure this matches the provided subscription key
                'X-Target-Environment': 'sandbox' // Ensure this matches the target environment
            }
        });

        // Log the response from the MTN MoMo API
        console.log('Response from MTN MoMo API:', JSON.stringify(response.data, null, 2));

        // Send the status of the payment back to the client
        res.status(response.status).json(response.data);
    } catch (error) {
        // Log detailed error information
        console.error('Error in checking payment status:', {
            message: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });

        // If the error response exists, send that status and data, otherwise send 500
        const statusCode = error.response ? error.response.status : 500;
        const errorMessage = error.response ? error.response.data : 'Failed to check payment status';
        res.status(statusCode).send(errorMessage);


    }
});

app.get('/api/view-balance', async (req, res) => {
    try {
        console.log('Requesting balance information...');

        const response = await axios.get('https://sandbox.momodeveloper.mtn.com/collection/v1_0/account/balance', {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'Content-Type': 'application/json',
                'X-Target-Environment': 'sandbox'
            }
        });

        console.log('Balance Response:', JSON.stringify(response.data, null, 2));

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error retrieving balance:', {
            message: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });
        res.status(error.response ? error.response.status : 500).send(error.response ? error.response.data : 'Failed to retrieve balance');
    }
});


app.post('/api/request-withdrawal', async (req, res) => {
    const { amount, phoneNumber } = req.body;

    try {
        const referenceId = uuidv4();

        console.log('Incoming withdrawal request data:', { amount, phoneNumber });
        console.log('Generated Reference ID:', referenceId);

        const requestPayload = {
            amount,
            currency: 'EUR',
            externalId: '000304335',
            payer: {
                partyIdType: 'MSISDN',
                partyId: phoneNumber
            },
            payerMessage: 'Withdrawal from account',
            payeeNote: 'Withdrawal'
        };
        console.log('Withdrawal Request Payload:', JSON.stringify(requestPayload, null, 2));

        const response = await axios.post('https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttowithdraw', requestPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'X-Reference-Id': referenceId,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'Content-Type': 'application/json',
                'X-Target-Environment': 'sandbox'
            }
        });

        console.log('Response from MTN MoMo API:', JSON.stringify(response.data, null, 2));

        res.status(response.status).json({...response.data, referenceId: referenceId});
    } catch (error) {
        console.error('Error in request withdrawal:', {
            message: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });
        res.status(error.response ? error.response.status : 500).send(error.response ? error.response.data : 'Withdrawal request failed');
    }
});


app.post('/api/generate-token', async (req, res) => {
    try {
        // Log the initiation of token generation
        console.log('Requesting new authorization token...');

        // Base64 encode the API user ID and API key using Node's Buffer
        const credentials = `${process.env.REFERENCE_ID}:${process.env.API_KEY}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');

        // Make the request to the MTN MoMo API for token generation
        const response = await axios.post('https://sandbox.momodeveloper.mtn.com/collection/token/', null, {
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY, // MoMo subscription key
                'Authorization': `Basic ${encodedCredentials}` // Base64 encoded credentials
            }
        });

        // Log the response for debugging
        console.log('New Token Response:', response.data);
        // Extract the access token from the response
        const newToken = response.data.access_token;
        const envFilePath = path.resolve(__dirname, '.env');

        // Read existing .env file content
        let envContent = fs.readFileSync(envFilePath, 'utf8');

        // Update or add the ACCESS_TOKEN entry
        const tokenRegex = /^ACCESS_TOKEN=.*$/m;
        if (tokenRegex.test(envContent)) {
            envContent = envContent.replace(tokenRegex, `ACCESS_TOKEN=${newToken}`);
        } else {
            envContent += `ACCESS_TOKEN=${newToken}\n`;
        }

        // Write updated content to .env file
        fs.writeFileSync(envFilePath, envContent);

        // Send the token response to the client
        res.status(200).json({
            access_token: response.data.access_token,
            token_type: response.data.token_type,
            expires_in: response.data.expires_in
        });
    } catch (error) {
        // Log the error details
        console.error('Error generating new token:', {
            message: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });

        // Return the error status and message
        const statusCode = error.response ? error.response.status : 500;
        const errorMessage = error.response ? error.response.data : 'Failed to generate token';
        res.status(statusCode).send(errorMessage);
    }
});

app.get('/api/withdrawal-status/:referenceId', async (req, res) => {
    const { referenceId } = req.params;

    try {
        console.log(`Checking status for withdrawal with Reference ID: ${referenceId}`);

        const response = await axios.get(`https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttowithdraw/${referenceId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'Content-Type': 'application/json',
                'X-Target-Environment': 'sandbox'
            }
        });

        console.log('Withdrawal Status Response:', JSON.stringify(response.data, null, 2));

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error retrieving withdrawal status:', {
            message: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });
        res.status(error.response ? error.response.status : 500).send(error.response ? error.response.data : 'Failed to retrieve withdrawal status');
    }
});


// Endpoint to handle callbacks from MoMo
app.route('/callback')
    .post((req, res) => {
        console.log('POST callback received:', req.body);
        // Process the POST callback data here
        res.status(200).send('POST Callback received');
    })
    .put((req, res) => {
        console.log('PUT callback received:', req.body);
        // Process the PUT callback data here
        res.status(200).send('PUT Callback received');
    });
app.listen(3001, () => {
    console.log('Server is running on port 3001');
});
