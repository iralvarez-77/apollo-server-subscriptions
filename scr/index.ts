import { ApolloServer } from "@apollo/server";
import { PubSub } from 'graphql-subscriptions';
import { createServer } from 'http';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import bodyParser from 'body-parser';
import express from 'express';
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

const URL_APi_FAKE = 'http://localhost:4001/coins';
const pubsub = new PubSub();

const typeDefs = `#graphql

type Coin {
  coinType : String!
  description : String!
  salePrice: Int!
  purchasePrice: Int!
}

type Query {
  coins: [Coin]
}

type Mutation {
  addCoin(coinType: String, description: String, salePrice: Int, purchasePrice: Int) : Coin
}

type Subscription {
  coinCreated: Coin
}
`;

const resolvers = {
  
  Query: {
    coins: async () => {
      const { data } = await axios.get(URL_APi_FAKE);
      return data;
    }
  },

  Mutation : {
    addCoin :  async (parent: void, args: any) => {
      const newCoin = {...args, id: uuidv4()};
      const { data : coin } = await axios.post(URL_APi_FAKE, newCoin);

      pubsub.publish('COIN_CREATED', { coinCreated: coin });
      return coin; 
    }
  },

  Subscription: {
    coinCreated: {
      subscribe: () => pubsub.asyncIterator(['COIN_CREATED'])
    }
  }
};

const app = express();
const httpServer = createServer(app);

const schema = makeExecutableSchema({ typeDefs, resolvers,});

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();

const wsServer = new WebSocketServer({
  server : httpServer,
  path: '/graphql',
});

const serverCleanup = useServer({ schema }, wsServer);

app.use('/graphql', cors<cors.CorsRequest>(), bodyParser.json(), expressMiddleware(server));

const PORT = 4002;
httpServer.listen(PORT, () => console.log(`Server is now running on http://localhost:${PORT}/graphql`))
  
