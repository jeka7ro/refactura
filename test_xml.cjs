const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const xmlContent = '<Invoice><cac:InvoiceLine><cac:Item><cbc:Name>DRA opacă LEKA 140x300 gri</cbc:Name></cac:Item></cac:InvoiceLine></Invoice>';
const parsed = parser.parse(xmlContent);
console.log(parsed.Invoice['cac:InvoiceLine']['cac:Item']['cbc:Name']);
