const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const fs = require("fs");

exports.updateDoc = (response) => {
    
    // Load the docx file as binary content
        try{
            const content = fs.readFileSync(__dirname + "/template.docx",
                "binary"
            );
            
            const zip = new PizZip(content);
            
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });
            
            // Render the document (Replace {first_name} by John, {last_name} by Doe, ...)
            doc.render({
                owners: response.owners,
                owner1: response.owners.split(" AND ")[0],
                owner2: response.owners.split(" AND ")[1],
                purchaser: response.buyerNames,
                plan: response.legalPlan,
                block: response.legalBlock,
                lot: response.legalLot,
                property_address: response.propertyAddress,
                closing_date: response.closingDate,
                bank_name: response.bankName,
                bank_address1: response.bankAddress.split(/, (.*)/s)[0],
                bank_address2: response.bankAddress.split(/, (.*)/s)[1]

            });
            
            const buf = doc.getZip().generate({
                type: "nodebuffer",
                // compression: DEFLATE adds a compression step.
                // For a 50MB output document, expect 500ms additional CPU time
                compression: "DEFLATE",
            });
            
            // buf is a nodejs Buffer, you can either write it to a
            // file or res.send it with express for example.
            return buf;
            }catch(e){
                console.log(e)
                return { code: 500, message: "Something went wrong!"}
            }
    

}