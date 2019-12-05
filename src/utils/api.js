const creds = require('./creds')

const axios = require('axios')
const Storyblok = require('storyblok-js-client')
const inquirer = require('inquirer')

const { LOGIN_URL, SIGNUP_URL, API_URL } = require('../constants')

module.exports = {
  accessToken: '',
  spaceId: null,

  getClient () {
    return new Storyblok({
      oauthToken: this.accessToken
    }, API_URL)
  },

  getPath (path) {
    if (this.spaceId) {
      return `spaces/${this.spaceId}/${path}`
    }

    return path
  },

  async login (email, password) {
    try {
      const response = await axios.post(LOGIN_URL, {
        email: email,
        password: password
      })

      const { data } = response

      if (data.otp_required) {
        const questions = [
          {
            type: 'input',
            name: 'otp_attempt',
            message: 'We sent a code to your email/phone, please insert the authentication code:',
            validate (value) {
              if (value.length > 0) {
                return true
              }

              return 'Code cannot blank'
            }
          }
        ]

        const { otp_attempt: code } = await inquirer.prompt(questions)

        const newResponse = await axios.post(LOGIN_URL, {
          email: email,
          password: password,
          otp_attempt: code
        })

        return this.processLogin(email, newResponse.data || {})
      }

      return this.processLogin(email, data)
    } catch (e) {
      return Promise.reject(e)
    }
  },

  processLogin (email, data) {
    const token = this.extractToken(data)
    this.accessToken = token
    creds.set(email, token)

    return Promise.resolve(data)
  },

  extractToken (data) {
    return data.access_token
  },

  logout () {
    creds.set(null)
  },

  signup (email, password) {
    return axios.post(SIGNUP_URL, {
      email: email,
      password: password
    })
      .then(response => {
        const token = this.extractToken(response)
        this.accessToken = token
        creds.set(email, token)

        return Promise.resolve(true)
      })
      .catch(err => Promise.reject(err))
  },

  isAuthorized () {
    const { token } = creds.get() || {}

    if (token) {
      this.accessToken = token
      return true
    }

    return false
  },

  setSpaceId (spaceId) {
    this.spaceId = spaceId
  },

  getComponents () {
    const client = this.getClient()

    return client
      .get(this.getPath('components'))
      .then(data => data.data.components || [])
      .catch(err => Promise.reject(err))
  },

  post (path, props) {
    return this.sendRequest(path, 'post', props)
  },

  put (path, props) {
    return this.sendRequest(path, 'put', props)
  },

  get (path) {
    return this.sendRequest(path, 'get')
  },

  delete (path) {
    return this.sendRequest(path, 'delete')
  },

  sendRequest (path, method, props = {}) {
    const client = this.getClient()
    const _path = this.getPath(path)

    return client[method](_path, props)
  }
}
