/**
 * @generated SignedSource<<6c766ab30884916c90d91d4a17c26690>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TransactionsPage_transactions$data = {
  readonly recentTransactions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly amountIn0: string;
        readonly amountIn1: string;
        readonly amountOut0: string;
        readonly amountOut1: string;
        readonly id: string;
        readonly timestamp: string;
        readonly token0: {
          readonly address: string;
          readonly id: string;
          readonly symbol: string | null;
          readonly " $fragmentSpreads": FragmentRefs<"InlineTokenSwapFragment" | "TokenAmountFragment" | "TokenPairFragment">;
        } | null;
        readonly token1: {
          readonly address: string;
          readonly id: string;
          readonly symbol: string | null;
          readonly " $fragmentSpreads": FragmentRefs<"InlineTokenSwapFragment" | "TokenAmountFragment" | "TokenPairFragment">;
        } | null;
        readonly txHash: string;
        readonly userAddress: string;
        readonly valueUSD: string | null;
      };
    }>;
    readonly pageInfo: {
      readonly endCursor: string | null;
      readonly hasNextPage: boolean;
    };
    readonly totalCount: number;
  };
  readonly " $fragmentType": "TransactionsPage_transactions";
};
export type TransactionsPage_transactions$key = {
  readonly " $data"?: TransactionsPage_transactions$data;
  readonly " $fragmentSpreads": FragmentRefs<"TransactionsPage_transactions">;
};

const node: ReaderFragment = (function(){
var v0 = [
  "recentTransactions"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  (v1/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "address",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "symbol",
    "storageKey": null
  },
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "TokenPairFragment"
  },
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "InlineTokenSwapFragment"
  },
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "TokenAmountFragment"
  }
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": require('./TransactionsPagePaginationQuery.graphql')
    }
  },
  "name": "TransactionsPage_transactions",
  "selections": [
    {
      "alias": "recentTransactions",
      "args": null,
      "concreteType": "SwapConnection",
      "kind": "LinkedField",
      "name": "__TransactionsPage__recentTransactions_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SwapEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Swap",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "txHash",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "timestamp",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "userAddress",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Token",
                  "kind": "LinkedField",
                  "name": "token0",
                  "plural": false,
                  "selections": (v2/*: any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Token",
                  "kind": "LinkedField",
                  "name": "token1",
                  "plural": false,
                  "selections": (v2/*: any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "amountIn0",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "amountIn1",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "amountOut0",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "amountOut1",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "valueUSD",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalCount",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "5711f0ed672aa47fd186d740b161a0ea";

export default node;
