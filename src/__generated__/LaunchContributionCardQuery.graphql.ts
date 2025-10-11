/**
 * @generated SignedSource<<588f3db28b59f7987127b0deef1647b9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LaunchContributionCardQuery$variables = {
  launchId: number;
};
export type LaunchContributionCardQuery$data = {
  readonly launch: {
    readonly " $fragmentSpreads": FragmentRefs<"LaunchContributionCard_launch">;
  } | null;
};
export type LaunchContributionCardQuery = {
  response: LaunchContributionCardQuery$data;
  variables: LaunchContributionCardQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "launchId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "launchId",
    "variableName": "launchId"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LaunchContributionCardQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Launch",
        "kind": "LinkedField",
        "name": "launch",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "LaunchContributionCard_launch"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LaunchContributionCardQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Launch",
        "kind": "LinkedField",
        "name": "launch",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "launchId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tokenAddress",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "creatorAddress",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "imageUri",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "kubRaised",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderRaised",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "status",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "kubPairAddress",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderPairAddress",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "hasDualPools",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderPoolSkipped",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "kubLiquidity",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderLiquidity",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderBurned",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lpWithdrawn",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lpWithdrawnAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "completedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "cancelledAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "createdAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "updatedAt",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3ed1b93c05efa07a6fe993bfde392b49",
    "id": null,
    "metadata": {},
    "name": "LaunchContributionCardQuery",
    "operationKind": "query",
    "text": "query LaunchContributionCardQuery(\n  $launchId: Int!\n) {\n  launch(launchId: $launchId) {\n    ...LaunchContributionCard_launch\n    id\n  }\n}\n\nfragment LaunchContributionCard_launch on Launch {\n  id\n  launchId\n  tokenAddress\n  creatorAddress\n  imageUri\n  kubRaised\n  ponderRaised\n  status\n  kubPairAddress\n  ponderPairAddress\n  hasDualPools\n  ponderPoolSkipped\n  kubLiquidity\n  ponderLiquidity\n  ponderBurned\n  lpWithdrawn\n  lpWithdrawnAt\n  completedAt\n  cancelledAt\n  createdAt\n  updatedAt\n}\n"
  }
};
})();

(node as any).hash = "0b21f7c98b23eb867dc0621b59006f0a";

export default node;
