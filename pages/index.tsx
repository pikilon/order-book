import React, { FunctionComponent, useEffect, useState } from "react";
import Layout from "../components/Layout";
import { OrderbookItem } from "../components/OrderbookItem";
const W3CWebSocket = require("websocket").w3cwebsocket;

const FEED = "wss://www.cryptofacilities.com/ws/v1";
const FEED_ID = "book_ui_1";
const PRERENDER_MAX_SECONDS = 2;

const getSubscriptionParams = (unsubscribe = false) =>
  JSON.stringify({
    event: unsubscribe ? "unsubscribe" : "subscribe",
    feed: FEED_ID,
    product_ids: ["PI_XBTUSD"],
  });

type TAskBid = [number, number];

type TAskBidTotal = { price: number; size: number };

const setAskBidToMap = (
  askBid: TAskBid,
  targetMap: Map<number, TAskBidTotal>
) => {
  const [price, size] = askBid;
  if (size === 0) {
    targetMap.delete(price);
  } else {
    targetMap.set(price, { price, size });
  }
  return targetMap;
};

const setInitialMaps = (asksBids: TAskBid[]) => {
  const result: Map<number, TAskBidTotal> = new Map();
  asksBids.forEach((askBid) => setAskBidToMap(askBid, result));
  return result;
};

interface Props {
  initialAsks: TAskBid[];
  initialBids: TAskBid[];
}

const IndexPage: FunctionComponent<Props> = ({ initialAsks, initialBids }) => {
  const [asksMap, setAsksMap] = useState(setInitialMaps(initialAsks));
  const [bidsMap, setBidsMap] = useState(setInitialMaps(initialBids));

  const updateAskBid = (isBid: Boolean) => (askBid: TAskBid) => {
    const mapToUpdate = isBid ? bidsMap : asksMap;
    const update = isBid ? setBidsMap : setAsksMap;

    const resultMap = new Map(setAskBidToMap(askBid, mapToUpdate));
    update(resultMap);
  };
  useEffect(() => {
    const socket = new WebSocket(FEED);
    let count = 0;

    socket.onopen = () => {
      socket.send(getSubscriptionParams());
    };

    socket.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      const { asks, bids } = data;

      if (asks) {
        (asks as TAskBid[]).forEach(updateAskBid(false));
      }

      if (bids) {
        (bids as TAskBid[]).forEach(updateAskBid(true));
      }
      count++;
      if (count === 85) socket.send(getSubscriptionParams(true));
    };

    return () => {
      socket.send(getSubscriptionParams(true));
      socket.close();
    };
  }, []);

  let totalBids = 0;

  return (
    <Layout title="Home | Next.js + TypeScript Example">
      <h1>Hello Next.js 👋</h1>
      <table>
        <thead>
          <tr>
            <th>Price</th>
            <th>Size</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(bidsMap.values()).map((bid) => (
            <OrderbookItem
              key={bid.price}
              {...bid}
              total={((totalBids += bid.price), totalBids)}
            />
          ))}
        </tbody>
      </table>
    </Layout>
  );
};

export default IndexPage;

export async function getStaticProps() {
  const props = await new Promise((resolve) => {
    const result: Props = { initialAsks: [], initialBids: [] };
    const socket = new W3CWebSocket(FEED);
    socket.onopen = () => {
      socket.send(getSubscriptionParams());
    };
    socket.onmessage = (msg: { data: string }) => {
      const data = JSON.parse(msg.data);
      const { asks, bids, feed } = data;

      if (feed === "book_ui_1_snapshot") {
        result.initialAsks = asks;
        result.initialBids = bids;

        socket.send(getSubscriptionParams(true));
        socket.close();
        resolve(result);
      }
    };
  });

  return { props, revalidate: PRERENDER_MAX_SECONDS };
}
