disable_mlock = true

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

storage "inmem" {}

plugin_directory = "/opt/openbao/plugins"

api_addr = "http://127.0.0.1:8200"
cluster_addr = "http://127.0.0.1:8201"