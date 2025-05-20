export const getIpfsGateway = (uri: string): string => {
  return uri?.replace('ipfs://', 'https://magic.decentralized-content.com/')
}
