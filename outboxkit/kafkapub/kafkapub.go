// Package kafkapub is an outboxkit.Publisher backed by Kafka/Redpanda via
// franz-go. It lives in its own module so outboxkit's core carries no broker
// dependency — import this only where you actually publish to Kafka.
//
// Every message is produced to a single stream topic (e.g. "market.events")
// with the outbox row's domain topic carried in a "domain-topic" header and the
// row id as the record key, so consumers can dispatch and dedup.
package kafkapub

import (
	"context"
	"strconv"

	"github.com/NichoHo/outboxkit"
	"github.com/twmb/franz-go/pkg/kgo"
)

type Publisher struct {
	client *kgo.Client
	stream string
}

// New dials the brokers and returns a Publisher that produces to streamTopic.
// Batches are produced uncompressed so any consumer can read them without a
// native codec library (franz-go's default is snappy). Outbox payloads are
// small JSON, so compression buys little here.
func New(brokers []string, streamTopic string) (*Publisher, error) {
	client, err := kgo.NewClient(
		kgo.SeedBrokers(brokers...),
		kgo.AllowAutoTopicCreation(),
		kgo.ProducerBatchCompression(kgo.NoCompression()),
	)
	if err != nil {
		return nil, err
	}
	return &Publisher{client: client, stream: streamTopic}, nil
}

// Publish produces the batch and waits for broker acks. It returns the first
// error, which makes the whole batch a relay retry (at-least-once).
func (p *Publisher) Publish(ctx context.Context, msgs []outboxkit.Message) error {
	records := make([]*kgo.Record, len(msgs))
	for i, m := range msgs {
		records[i] = &kgo.Record{
			Topic: p.stream,
			Key:   []byte(strconv.FormatInt(m.ID, 10)),
			Value: m.Payload,
			Headers: []kgo.RecordHeader{
				{Key: "domain-topic", Value: []byte(m.Topic)},
			},
		}
	}
	return p.client.ProduceSync(ctx, records...).FirstErr()
}

// Close flushes and closes the underlying client.
func (p *Publisher) Close() { p.client.Close() }
