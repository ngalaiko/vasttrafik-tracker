FROM golang:1.24.1-alpine3.20 as builder
WORKDIR /src
COPY . /src/
RUN go build -o /usr/bin/backend /src/cmd/server

FROM alpine:3.20
COPY --from=builder /usr/bin/backend /usr/bin/backend
ENTRYPOINT [ "/usr/bin/backend", "--address", "0.0.0.0:8080" ]
