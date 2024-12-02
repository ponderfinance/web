'use client'

import { useState } from 'react'
import { Address } from 'viem'
import { Text, Card, Button, View } from 'reshaped'
import { usePonderSDK } from '@/app/providers/ponder'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const createPairSchema = z.object({
  tokenA: z.string().startsWith('0x').length(42),
  tokenB: z.string().startsWith('0x').length(42),
})

type FormValues = z.infer<typeof createPairSchema>

export default function CreatePair() {
  const { sdk, isReady } = usePonderSDK()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<FormValues>()

  const onSubmit = async (data: FormValues) => {
    if (!sdk) return

    try {
      const validatedData = createPairSchema.parse(data)

      setIsLoading(true)
      setError('')

      const tx = await sdk.factory.createPair({
        tokenA: validatedData.tokenA as Address,
        tokenB: validatedData.tokenB as Address,
      })

      await tx.wait()
      reset()
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError('Invalid address format')
      } else {
        setError(err.message || 'Failed to create pair')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!isReady) {
    return (
      <Card>
        <View align="center" justify="center">
          <Text>Loading...</Text>
        </View>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <View gap={16}>
          <View gap={8}>
            <Text variant="title-3">Create Liquidity Pair</Text>

            {error && <Text>{error}</Text>}

            <View gap={4}>
              <Text>Token A Address</Text>
              <input
                type="text"
                placeholder="0x..."
                {...register('tokenA')}
                style={{
                  padding: '8px',
                  width: '100%',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
              {errors.tokenA && <Text>Invalid token A address</Text>}
            </View>

            <View gap={4}>
              <Text>Token B Address</Text>
              <input
                type="text"
                placeholder="0x..."
                {...register('tokenB')}
                style={{
                  padding: '8px',
                  width: '100%',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
              {errors.tokenB && <Text>Invalid token B address</Text>}
            </View>
          </View>

          <Button type="submit" disabled={isLoading} loading={isLoading} fullWidth>
            Create Pair
          </Button>
        </View>
      </form>
    </Card>
  )
}
