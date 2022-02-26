const AWS = require('aws-sdk');
const crypto = require('crypto');
require('dotenv').config();

const s3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
});

const algorithm = "aes-256-cbc";
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
const dDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {

        const publicAccessKey = Buffer.from(event.publicKey, 'base64');
        const fileId = event.file;

        if (!publicAccessKey || !fileId) {
            return sendRes(404, "Missing required parameter");
        }

        //file fetch from db
        let fileData = await dDB.get({
            TableName: 'LookUp',
            Key: {
                id: fileId
            }
        }).promise();
        if (!fileData) {
            return sendRes(404, "File not found");
        }

        //search for file from s3
        let s3FileData = await s3.getObject({
            Bucket: process.env.BUCKET_NAME,
            Key: `${fileData.Item.id}.txt`
        }).promise();
        if (!s3FileData) {
            return sendRes(404, "File not found");
        }

        //dcrypt
        const decipher = crypto.createDecipheriv(algorithm, encryptionKey, publicAccessKey);
        let decryptedData = decipher.update(s3FileData.Body.toString('utf-8'), "hex", "utf-8");
        decryptedData += decipher.final("utf8");

        //send buffer & base64
        let fileResponse = {
            type: fileData.Item.type,
            fileName: fileData.Item.name,
            dataBase64: decryptedData,
            dataBuffer: Buffer.from(decryptedData, 'base64')
        };

        return sendRes(200, fileResponse);
    } catch (error) {
        return sendRes(404, error);
    }
};

const sendRes = (status, body) => {
    var response = {
        statusCode: status,
        body: body
    };
    return response;
};