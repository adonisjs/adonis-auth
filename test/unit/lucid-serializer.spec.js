'use strict'

/*
 * adonis-auth
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

require('@adonisjs/lucid/lib/iocResolver').setFold(require('@adonisjs/fold'))

const test = require('japa')
const { ioc } = require('@adonisjs/fold')

const { lucid: LucidSerializer } = require('../../src/Serializers')
const helpers = require('./helpers')
const setup = require('./setup')

test.group('Serializers - Lucid', (group) => {
  setup.databaseHook(group)
  setup.hashHook(group)

  test('generate correct query to fetch user by id', async (assert) => {
    const User = helpers.getUserModel()
    let authQuery = null
    User.onQuery((query) => (authQuery = query))

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer()
    lucid.setConfig(config)
    await lucid.findById(1)

    assert.equal(authQuery.sql, 'select * from "users" where "id" = ? limit ?')
    assert.deepEqual(authQuery.bindings, [1, 1])
  })

  test('generate correct query to fetch user by uid', async (assert) => {
    const User = helpers.getUserModel()

    let authQuery = null
    User.onQuery((query) => (authQuery = query))

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer()
    lucid.setConfig(config)
    await lucid.findByUid('foo@bar.com')

    assert.equal(authQuery.sql, 'select * from "users" where "email" = ? limit ?')
    assert.deepEqual(authQuery.bindings, ['foo@bar.com', 1])
  })

  test('return false when unable to match password', async (assert) => {
    const User = helpers.getUserModel()

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    const user = new User()
    user.email = 'foo@bar.com'
    user.password = 'secret'
    await user.save()

    const verified = await lucid.validateCredentails(user, 'foo')
    assert.isFalse(verified)
  })

  test('return false when unable to match password', async (assert) => {
    const User = helpers.getUserModel()

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    const user = new User()
    user.email = 'foo@bar.com'
    user.password = 'secret'
    await user.save()

    const verified = await lucid.validateCredentails(user, 'foo')
    assert.isFalse(verified)
  })

  test('return true when password matches', async (assert) => {
    const User = helpers.getUserModel()

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    const user = new User()
    user.email = 'foo@bar.com'
    user.password = 'secret'
    await user.save()

    const verified = await lucid.validateCredentails(user, 'secret')
    assert.isTrue(verified)
  })

  test('return add runtime constraints to query builder', async (assert) => {
    const User = helpers.getUserModel()

    let authQuery = null
    User.onQuery((query) => (authQuery = query))

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    await lucid.query(function (builder) {
      builder.where('is_active', true)
    }).findById(1)

    assert.equal(authQuery.sql, 'select * from "users" where "is_active" = ? and "id" = ? limit ?')
  })

  test('make correct findByToken query', async (assert) => {
    const User = helpers.getUserModel()

    let authQuery = null
    User.onQuery((query) => (authQuery = query))

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    await lucid.findByToken('20', 'remember_token')
    assert.equal(
      authQuery.sql,
      'select * from "users" where exists (select * from "tokens" where "token" = ? and "type" = ? and "is_revoked" = ? and users.id = tokens.user_id) limit ?'
    )
    assert.deepEqual(authQuery.bindings, ['20', 'remember_token', false, 1])
  })

  test('save token for a given user', async (assert) => {
    const User = helpers.getUserModel()

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    const user = await User.create({ email: 'foo@bar.com', password: 'secret' })
    let tokensQuery = null
    user.tokens().RelatedModel.onQuery((query) => (tokensQuery = query))

    await lucid.saveToken(user, '20', 'remember_token')
    assert.equal(
      tokensQuery.sql,
      'insert into "tokens" ("is_revoked", "token", "type", "user_id") values (?, ?, ?, ?)'
    )
    assert.deepEqual(tokensQuery.bindings, [false, '20', 'remember_token', 1])
  })

  test('remove single token for a given user', async (assert) => {
    const User = helpers.getUserModel()

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    const user = await User.create({ email: 'foo@bar.com', password: 'secret' })
    let tokensQuery = null
    user.tokens().RelatedModel.onQuery((query) => (tokensQuery = query))

    await lucid.revokeTokens(user, '20')
    assert.equal(
      tokensQuery.sql,
      'update "tokens" set "is_revoked" = ? where "token" in (?) and "user_id" = ?'
    )
    assert.deepEqual(tokensQuery.bindings, [true, '20', 1])
  })

  test('remove all tokens for a given user', async (assert) => {
    const User = helpers.getUserModel()

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    const user = await User.create({ email: 'foo@bar.com', password: 'secret' })
    let tokensQuery = null
    user.tokens().RelatedModel.onQuery((query) => (tokensQuery = query))

    await lucid.revokeTokens(user)
    assert.equal(
      tokensQuery.sql,
      'update "tokens" set "is_revoked" = ? where "user_id" = ?'
    )
    assert.deepEqual(tokensQuery.bindings, [true, 1])
  })

  test('remove multiple tokens for a given user', async (assert) => {
    const User = helpers.getUserModel()

    const config = {
      model: User,
      uid: 'email',
      password: 'password'
    }

    const lucid = new LucidSerializer(ioc.use('Hash'))
    lucid.setConfig(config)

    const user = await User.create({ email: 'foo@bar.com', password: 'secret' })
    let tokensQuery = null
    user.tokens().RelatedModel.onQuery((query) => (tokensQuery = query))

    await lucid.revokeTokens(user, ['20', '30'])
    assert.equal(
      tokensQuery.sql,
      'update "tokens" set "is_revoked" = ? where "token" in (?, ?) and "user_id" = ?'
    )
    assert.deepEqual(tokensQuery.bindings, [true, '20', '30', 1])
  })
})