const serverless = require('serverless-http');
const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require("path")
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3")
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda")
const cors = require('cors');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors({
    origin: '*'
}));

const s3 = new S3Client({
    region: "us-east-1"
});

const lambda = new LambdaClient({ region: "us-east-1" });

const upload = function (folderName) {

    return multer({
        limits: { fileSize: 5 * 1000 * 1000 },
        fileFilter: function (req, file, callback) {
            let fileExtension = (file.originalname.split('.')[file.originalname.split('.').length - 1]).toLowerCase(); // convert extension to lower case

            if (["pdf"].indexOf(fileExtension) === -1) {
                return callback(new Error('Wrong file type'));
            }
            callback(null, true);
        },
        storage: multerS3({
            s3,
            // acl: 'public-read',
            bucket: "loan-doc-files",
            // contentType: multerS3.AUTO_CONTENT_TYPE,
            key: (req, file, cb) => {
                const destinationPath = new Date().getFullYear() + '/' + (new Date().getMonth() + 1) + '/' + new Date().getDate() + '/' + folderName + '/'
                const fileName = file.fieldname;
                cb(null, `${destinationPath}${fileName}${path.extname(file.originalname)}`);
            }
        })
    });
}


app.post('/api/createJob', async (req, res) => {
    try {
        const randomFolderName = Math.round(Math.random() * 1E9)
        const uploadMultipleFiles = upload(randomFolderName).fields(
            [
                {
                    name: 'title',
                    maxCount: 1
                },
                {
                    name: 'tax',
                    maxCount: 1
                },
                {
                    name: 'mortgage',
                    maxCount: 1
                },
                {
                    name: 'contract',
                    maxCount: 1
                }
            ]
        );

        uploadMultipleFiles(req, res, async (err, fileName) => {
            if (err) {
                return res.status(400).send({ message: err.message })
            }

            const filePaths = []
            Object.entries(req.files).map(([key, value]) => {
                filePaths.push(req.files[key][0].key)
            })

            const lambdaParams = {
                FunctionName: 'mortgage-docs-api-dev-docProcessor',
                InvocationType: 'Event',
                Payload: JSON.stringify({ filePaths, jobId: randomFolderName}),
            };

            console.log("Starting Lambda Invocation!")

            const response = await lambda.send(new InvokeCommand(lambdaParams));

            console.log("Lambda Invoked!")

            const resp = { status: true, jobId: randomFolderName }
            res.send(resp);
        })
    } catch (e) {
        console.log("Error occurred in create job == ", e)
        res.send({ status: false, message: "Something went wrong!" })
    }
});

const streamToString = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString('base64')));
    });


app.post('/api/getResults', async (req, res) => {
    try {
        if (typeof req.body.jobId != 'undefined' && req.body.jobId != '') {
            const key = new Date().getFullYear() + '/' + (new Date().getMonth() + 1) + '/' + new Date().getDate() + '/' + req.body.jobId + '/' + 'sales.docx'

            const params = {
                Bucket: 'loan-doc-files',
                Key: key
            };

            const getObjectCommand = new GetObjectCommand(params)

            const respObject = await s3.send(getObjectCommand)
            const bodyContents = await streamToString(respObject.Body);
            // const base64String = Buffer.from(bodyContents, 'binary').toString('base64')
            res.send({ status: true, data: bodyContents })


        } else {
            return res.status(400).send({ status: false, message: 'Please enter valid jobId' })
        }
    } catch (e) {
        console.log("Error occurred in getting results == ", e)
        res.send({ status: false, message: "Something went wrong!" })
    }

})

// app.listen(3002, () => console.log(`Listening on: 3002`));
// export const handler = serverless(app);
module.exports.handler = serverless(app);