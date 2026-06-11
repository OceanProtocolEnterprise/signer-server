# Stage 1: build the plugin
FROM golang:1.21-alpine AS plugin-builder
RUN apk add --no-cache git make
RUN git clone https://github.com/pelipas/vault-plugin-secp256k1.git /build
WORKDIR /build
RUN CGO_ENABLED=0 go build -o secpsign .

FROM openbao/openbao:latest

USER root

RUN apk add --no-cache jq

RUN mkdir -p /opt/openbao/plugins \
    && mkdir -p /opt/openbao/scripts \
    && mkdir -p /vault/keys \
    && mkdir -p /etc/openbao

COPY --from=plugin-builder /build/secpsign /opt/openbao/plugins/secpsign
COPY init-vault.sh /opt/openbao/scripts/init-vault.sh
COPY openbao.hcl /etc/openbao/openbao.hcl

RUN chmod +x /opt/openbao/plugins/secpsign \
    && chmod +x /opt/openbao/scripts/init-vault.sh

ENV BAO_ADDR=http://127.0.0.1:8200

ENTRYPOINT ["/bin/sh", "-c", "/opt/openbao/scripts/init-vault.sh & exec bao server -config=/etc/openbao/openbao.hcl"]
