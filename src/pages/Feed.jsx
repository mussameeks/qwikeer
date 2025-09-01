import React from "react";
import { feedItems } from "../data.js";

export default function Feed() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Feed</h1>
      <div className="space-y-3">
        {feedItems.map((item) => (
          <div key={item.id} className="bg-gray-900 p-3 rounded-lg">
            <div className="font-semibold">{item.title}</div>
            <div className="text-xs text-gray-400">
              {item.source} • {item.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
