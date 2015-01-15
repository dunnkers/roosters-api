var util = require('util'),
  // deps
  mongoose = require('mongoose'),
  timestamps = require('mongoose-timestamp'),
  Schema = mongoose.Schema;

function AbstractSchema () {
  Schema.apply(this, arguments);

  this.add({
    items: [ { type: String, ref: 'Item', populate: 'sideload' } ]
  });

  this.options.collection = 'audiences';
  this.options.discriminatorKey = 'type';

  // createdAt and updatedAt properties
  this.plugin(timestamps);
}

util.inherits(AbstractSchema, Schema);


mongoose.model('Audience', new AbstractSchema());

module.exports = AbstractSchema;
