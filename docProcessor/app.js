const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const processDocuments = require('./components/processDocuments')
const { updateDoc } = require('./components/template');

const s3 = new S3Client({
  region: "us-east-1"
});


const uploadResultsToS3 = async (folderName, file) => {
  const filePath = new Date().getFullYear() + '/' + (new Date().getMonth() + 1) + '/' + new Date().getDate() + '/' + folderName + '/sales.docx';

  const params = {
    Bucket: 'loan-doc-files',
    Key: filePath,
    Body: file
  };


  const putObjectCmd = new PutObjectCommand(params)

  await s3.send(putObjectCmd)
}

module.exports.handler = async (event) => {
  try {
    const folderName = event.jobId
    console.log("New job received: ", folderName)

    const filePaths = event.filePaths
    const responseJson = await processDocuments(filePaths)
    console.log("Job id: ", folderName)
    console.log("AI Params: ", responseJson)

    const docxBin = await updateDoc(responseJson)
    console.log("Doc generated!")

    await uploadResultsToS3(folderName, docxBin)
    console.log("Doc Uploaded!")

    const response = { status: true, message: "Successfully Processed!" }
    return response;
  } catch (e) {
    console.log("Error occurred in create job == ", e)
    const response = { status: false, message: "Something went wrong!" }
    return response;
  }
};

