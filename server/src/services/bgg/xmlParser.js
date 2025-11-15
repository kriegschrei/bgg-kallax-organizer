import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXmlString = promisify(parseString);

const XML_PARSE_OPTIONS = {
  explicitArray: false,
  explicitRoot: false,
  mergeAttrs: false,
  attrkey: '$',
  charkey: '_',
  trim: true,
};

export const xmlToJson = async (xmlString) => {
  if (!xmlString) {
    return {};
  }

  try {
    return await parseXmlString(xmlString, XML_PARSE_OPTIONS);
  } catch (error) {
    const parsingError = new Error(`Failed to parse XML: ${error.message}`);
    parsingError.cause = error;
    throw parsingError;
  }
};


