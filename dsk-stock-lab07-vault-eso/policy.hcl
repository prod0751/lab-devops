path "secret/data/stock" {
  capabilities = ["read"]
}

# ESO validates the supplied token with lookup-self.
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
