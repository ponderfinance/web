export const getIpfsGateway = (uri: string): string => {
  return uri?.replace('ipfs://', 'https://lucidhaus.infura-ipfs.io/ipfs/')
}
