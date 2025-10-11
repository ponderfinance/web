/**
 * @generated SignedSource<<99e4cd7458325f15aeca894b56cb62de>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LaunchListViewQuery$variables = {};
export type LaunchListViewQuery$data = {
  readonly activeLaunches: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"LaunchListView_launch">;
      };
    }>;
  };
};
export type LaunchListViewQuery = {
  response: LaunchListViewQuery$data;
  variables: LaunchListViewQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "LaunchListViewQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "LaunchConnection",
        "kind": "LinkedField",
        "name": "activeLaunches",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LaunchEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Launch",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v0/*: any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "LaunchListView_launch"
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "LaunchListViewQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "LaunchConnection",
        "kind": "LinkedField",
        "name": "activeLaunches",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LaunchEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Launch",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v0/*: any*/),
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
                    "name": "imageUri",
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
                    "name": "kubRaised",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "ponderRaised",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "40f6925dcc083dd3e7323ba8283b8399",
    "id": null,
    "metadata": {},
    "name": "LaunchListViewQuery",
    "operationKind": "query",
    "text": "query LaunchListViewQuery {\n  activeLaunches {\n    edges {\n      node {\n        id\n        ...LaunchListView_launch\n      }\n    }\n  }\n}\n\nfragment LaunchListView_launch on Launch {\n  id\n  launchId\n  imageUri\n  status\n  kubRaised\n  ponderRaised\n}\n"
  }
};
})();

(node as any).hash = "99c3c3e945db7956c5ab8a29524c0601";

export default node;
