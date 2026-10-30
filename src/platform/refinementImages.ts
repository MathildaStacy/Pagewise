import BlobUtil from 'react-native-blob-util';

export const readRefinementImage = (uri: string): Promise<string> =>
  BlobUtil.fs.readFile(uri.replace(/^file:\/\//, ''), 'base64');
