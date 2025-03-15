import { PrismaClient } from '@prisma/client'
import { Loaders } from '../dataloader'

export interface Context {
  prisma: PrismaClient
  req?: Request
  loaders: Loaders
}
