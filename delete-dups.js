const fs = require("fs");
const { execSync } = require("child_process");

const uuidsToDelete = [
  "i331gbc1zzytx7via8lntdm6",
  "pow71xsobdas7etf5r3hy5ug",
  "l79dyd03lhtcpgi7swkoxm55",
  "ry6160tpy4gh2xjfwr011no0",
  "gfe78t8jm53lltentz19ze60",
  "e1cg7q8khyvpti5rkp351559",
  "c35cvvqxhdbslk8yc24g04wk",
  "ijj9pqkavlusy2wmzsbjtc74",
  "ghe6bzlr6ex6j51lgxzyhd46",
  "h3v45w2u1essulzeg56i27a3",
  "oxk05amog4fla0lskmkfx64x",
  "yxm4mn60lfp9qah0q4yf2hij",
  "ezjxo4ehs96lv0ji1n2r0auw",
  "t12x7pgptsqiu5gbvv35gun5",
  "urq1ll00a3vv9on6pulmpofe",
  "eb5zgw5wlgvio2gggbiphpam",
  "ld1h3pody4nxj3b44pbskl53",
  "x111xfygqxrlbf5wqlx59f6d",
  "se1weqr4dj7thp4p1l055wfc",
  "cqses6urxff0n94i0u6lktzt",
  "nvcir33nyuvzk5niy3s7eg9w",
  "s63onga2s6v8r3k10lrdwzth",
  "cf3uedqnjmwv48h7tm91d95r",
  "o9124dnnieau9wxoefyxvfgu",
  "kxzobc8qlvigbsk1d35dpiyi",
  "eh8lzjbsy2c9kwj2emztcmf6",
  "umfsos2vcmotfk2cfpqdoycc",
  "yn1mdh0fngiati6r4625qvv9"
];

const token = "1|vPZPgvB8vVi8ZD5ZKS8lrCrwNlPofVv4I8Tjmqmyd01f92d2";
const baseUrl = "https://coolify.worldwideview.dev/api/v1";
const appUuid = "nmn55t4io3myfubs72worn7k";

async function run() {
  for (const id of uuidsToDelete) {
    console.log("Deleting", id);
    try {
      const res = await fetch(`${baseUrl}/applications/${appUuid}/envs/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      console.log(id, res.status);
    } catch(e) {
      console.error(e);
    }
  }
}

run();
