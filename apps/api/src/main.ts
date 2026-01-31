import fastify from "fastify";
import { User } from "@dstelemetry/types";

const app = fastify();

app.get("/", (req, res) => {
  res.send(User.parse({ id: "1", name: "John Doe", email: "ohno@ham.com" }));
});

app.listen({ port: 3000 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});