import React from 'react'

export const SnackInfo = () => {
  return (
    <div className="w-full flex flex-col gap-4 mt-8 items-center p-6">
      <div className="w-full flex-col items-center">
        <h1 className="text-3xl mb-6" style={{ fontFamily: 'var(--font-silkscreen)' }}>
          Start Saving and Launch a Validator
        </h1>
        <p className="text-lg max-w-3xl">
          Snack Snack is a savings game, where you and your friends care for a digital pet
          and work together to achieve the goal of launching a validator on Ethereum!
        </p>
        <a
          style={{ fontFamily: 'var(--font-silkscreen)' }}
          className="inline-flex p-4 bg-black text-white rounded-full mt-6"
          href={
            'https://www.figma.com/design/YhlDm6wJBfdFhH1eAsUC4H/Snack-Snack?node-id=0-1&t=8Nn88Y5b65MHiznX-1'
          }
          target="_blank"
        >
          Learn More
        </a>
      </div>
    </div>
  )
}
