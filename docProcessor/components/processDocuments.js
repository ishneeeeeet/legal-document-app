const { TextractClient, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } = require("@aws-sdk/client-textract");
const { timeout } = require('../utils/index')
const queriesConfig = require('../queryConfig.json')


const client = new TextractClient({
        region: "us-east-1"
});

// Mapping queries with answers
const getMappedAnswers = async (responses) => {
    const queries = responses.filter((resp) => resp.BlockType === "QUERY" && resp.Relationships)
    const queryResults = responses.filter((resp) => resp.BlockType === "QUERY_RESULT")
    const keyValues = {}
    queries.map((query) => {
        let foundIndex = queryResults.findIndex((elem) => query.Relationships[0].Ids[0] === elem.Id)
        if (foundIndex != -1) keyValues[query.Query.Alias] = queryResults[foundIndex].Text
    })
    return keyValues
}


module.exports = async (filePaths) => {
    try {
        const jobIds = []
        for (const filePath of filePaths) {
            const fileName = filePath.split("/").pop().split(".")[0]
            const params = {
                DocumentLocation: {
                    S3Object: {
                        Bucket: "loan-doc-files",
                        Name: filePath
                    }
                    /* required */
                },
                QueriesConfig: {
                    Queries: queriesConfig[fileName].queries
                },
                FeatureTypes: ["QUERIES"]
            };
            // Process document and create job id for async processing
            const jobDetails = await client.send(new StartDocumentAnalysisCommand(params));
            jobIds.push({ id: jobDetails.JobId, jobStatus: "" })

        }

        const responses = []
        // Iterating job ids created in previous steps
        for (const [i, jobId] of jobIds.entries()) {
            // Checking status of job until success state
            while (jobIds[i].status !== "SUCCEEDED") {
                await timeout(3000)
                let data = await client.send(new GetDocumentAnalysisCommand({ JobId: jobId.id }))
                jobIds[i].status = data.JobStatus
                if (data && data.JobStatus === "SUCCEEDED" && data.Blocks) 
                 responses.push(...data.Blocks)
            }
        }

        // Mapping answers with each query
        const keyValues = await getMappedAnswers(responses);
        return keyValues;


    } catch (error) {
        console.log("err == ", error)
        // error handling.
    }
};
