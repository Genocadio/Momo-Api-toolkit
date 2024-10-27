// paymentRouter.js

const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid'); // Import the uuid library
const fs = require('fs');
const path = require('path');
const Transaction = require('../models/transactionModel'); // Import the Transaction model

const router = express.Router();

const checkMoMoService = (req, res, next) => {
    const service  = req.service; // Assume service is sent in the request body
    console.log('Service:', service, );
    if (service !== 'MOMO') {
        return res.status(401).json({ error: 'Invalid service. Only MoMo service is allowed.' });
    }
    next(); // Proceed to the next middleware/route handler
};

// Apply middleware to all routes in this router
router.use(checkMoMoService);

router.post('/request-payment', async (req, res) => {
    const { amount, phoneNumber } = req.body;

    try {
        const referenceId = uuidv4();

        const requestPayload = {
            amount,
            currency: 'EUR',
            externalId: '000304335',
            payer: {
                partyIdType: 'MSISDN',
                partyId: phoneNumber
            },
            payerMessage: 'MoMo Market Payment',
            payeeNote: 'MoMo Market Payment'
        };

        const response = await axios.post('https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay', requestPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'X-Reference-Id': referenceId,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'Content-Type': 'application/json',
                'X-Target-Environment': 'sandbox',
                'X-Callback-Url': `http://${process.env.CALLBACK_URL}/callback`
            }
        });
        const transaction = new Transaction({
            userId: req.user._id, // Assuming req.user is set by your auth middleware
            transactionType: 'payment',
            amount,
            phoneNumber,
            status: response.status === 202 ? 'pending' : 'failed' // Initial status
        });

        await transaction.save(); 

        if (process.env.REQUIRE_INSTANT_PAY === 'true' && response.status === 202) {
            const statusResponse = await axios.get(`https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${referenceId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                    'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                    'X-Target-Environment': 'sandbox'
                }
            });
            return res.status(statusResponse.status).json({ ...statusResponse.data, referenceId });
        }

        res.status(response.status).json({ ...response.data, referenceId });

    } catch (error) {
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).send(error.response ? error.response.data : 'Payment request failed');
    }
});

router.get('/payment-status/:referenceId', async (req, res) => {
    const { referenceId } = req.params;

    try {
        const response = await axios.get(`https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${referenceId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'X-Target-Environment': 'sandbox'
            }
        });

        res.status(response.status).json(response.data);
    } catch (error) {
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).send(error.response ? error.response.data : 'Failed to check payment status');
    }
});

router.get('/view-balance', async (req, res) => {
    try {
        const response = await axios.get('https://sandbox.momodeveloper.mtn.com/collection/v1_0/account/balance', {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'Content-Type': 'application/json',
                'X-Target-Environment': 'sandbox'
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).send(error.response ? error.response.data : 'Failed to retrieve balance');
    }
});

router.post('/request-withdrawal', async (req, res) => {
    const { amount, phoneNumber } = req.body;

    try {
        const referenceId = uuidv4();

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

        const response = await axios.post('https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttowithdraw', requestPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'X-Reference-Id': referenceId,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'Content-Type': 'application/json',
                'X-Target-Environment': 'sandbox'
            }
        });

        const transaction = new Transaction({
            userId: req.user._id, // Assuming req.user is set by your auth middleware
            transactionType: 'withdrawal',
            amount,
            phoneNumber,
            status: response.status === 202 ? 'pending' : 'failed' // Initial status
        });

        await transaction.save();

        res.status(response.status).json({ ...response.data, referenceId });
    } catch (error) {
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).send(error.response ? error.response.data : 'Withdrawal request failed');
    }
});

router.post('/generate-token', async (req, res) => {
    try {
        const credentials = `${process.env.REFERENCE_ID}:${process.env.API_KEY}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');

        const response = await axios.post('https://sandbox.momodeveloper.mtn.com/collection/token/', null, {
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'Authorization': `Basic ${encodedCredentials}`
            }
        });

        const newToken = response.data.access_token;
        const envFilePath = path.resolve(__dirname, '.env');

        let envContent = fs.readFileSync(envFilePath, 'utf8');
        const tokenRegex = /^ACCESS_TOKEN=.*$/m;

        if (tokenRegex.test(envContent)) {
            envContent = envContent.replace(tokenRegex, `ACCESS_TOKEN=${newToken}`);
        } else {
            envContent += `ACCESS_TOKEN=${newToken}\n`;
        }

        fs.writeFileSync(envFilePath, envContent);

        res.status(200).json(response.data);
    } catch (error) {
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).send(error.response ? error.response.data : 'Failed to generate token');
    }
});

router.get('/withdrawal-status/:referenceId', async (req, res) => {
    const { referenceId } = req.params;

    try {
        const response = await axios.get(`https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttowithdraw/${referenceId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Ocp-Apim-Subscription-Key': process.env.SUBSCRIPTION_KEY,
                'Content-Type': 'application/json',
                'X-Target-Environment': 'sandbox'
            }
        });

        res.status(response.status).json(response.data);
    } catch (error) {
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).send(error.response ? error.response.data : 'Failed to retrieve withdrawal status');
    }
});

// Callback route
router.route('/callback')
    .post((req, res) => {
        console.log('POST callback received:', req.body);
        res.status(200).send('POST Callback received');
    })
    .put((req, res) => {
        console.log('PUT callback received:', req.body);
        res.status(200).send('PUT Callback received');
    });

module.exports = router;
