# TESTE DE DIAGNOSTICO: imagem minima, sem npm, sem build.
# Se subir -> o problema estava no build. Se der 502 -> o problema e roteamento/porta.
FROM node:22-alpine
WORKDIR /app
RUN printf 'require("http").createServer((q,s)=>{s.writeHead(200,{"Content-Type":"application/json"});s.end(JSON.stringify({diagnostico:"ok",porta:3000}))}).listen(3000,"0.0.0.0",()=>console.log("teste no ar na 3000"))' > t.cjs
EXPOSE 3000
CMD ["node","t.cjs"]
