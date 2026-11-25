require 'csv'
require 'yaml'
require 'uri'
root = File.expand_path(ARGV.fetch(0, File.join(__dir__, '..')))
errors = []

def text?(value)
  value.is_a?(String) && !value.strip.empty?
end

def month?(value)
  value.is_a?(String) && value.match?(/\A[0-9]{4}-(0[1-9]|1[0-2])\z/)
end

def link?(value)
  return false unless text?(value) && value == value.strip

  uri = URI.parse(value)
  return true if uri.scheme == 'https' && text?(uri.host) && uri.userinfo.nil?

  uri.scheme.nil? && uri.host.nil? && value.start_with?('/') && !value.start_with?('//')
rescue URI::InvalidURIError
  false
end

begin
  status = YAML.safe_load(File.read(File.join(root, '_data/mm1_status.yml')))
  raise ArgumentError, 'Status must be a YAML mapping.' unless status.is_a?(Hash)

  allowed = %w[current_step steps message registration_url registration_label next_event]
  extra = status.keys - allowed
  errors << "Unknown status fields: #{extra.join(', ')}" unless extra.empty?
  steps = status['steps']
  valid_steps = steps.is_a?(Array) && steps.length == 5 && steps.all? { |step| text?(step) } && steps.uniq.length == 5
  errors << 'steps must contain five distinct, nonempty labels.' unless valid_steps
  current = status['current_step']
  errors << 'current_step must be an integer from 1 to 5.' unless current.is_a?(Integer) && (1..5).cover?(current)
  %w[message registration_label].each do |key|
    errors << "#{key} must contain text." unless text?(status[key])
  end
  errors << 'registration_url must be an HTTPS URL or a site path.' unless link?(status['registration_url'])

  event = status['next_event']
  unless event.nil?
    if event.is_a?(Hash)
      extra = event.keys - %w[month title description]
      errors << "Unknown next_event fields: #{extra.join(', ')}" unless extra.empty?
      errors << 'next_event.month must be a quoted YYYY-MM value.' unless month?(event['month'])
      %w[title description].each do |key|
        errors << "next_event.#{key} must contain text." unless text?(event[key])
      end
    else
      errors << 'next_event must be a mapping or omitted.'
    end
  end

  rows = CSV.read(File.join(root, '_data/mm1_log.csv'), headers: true, encoding: 'UTF-8')
  headers = %w[date title description link link_label]
  errors << "CSV header must be #{headers.join(',')}" unless rows.headers == headers
  seen = {}
  rows.each_with_index do |row, index|
    label = "Milestone #{index + 1}"
    errors << "#{label}: expected five fields." unless row.fields.length == headers.length
    errors << "#{label}: date must be YYYY-MM." unless month?(row['date'])
    %w[title description].each do |key|
      errors << "#{label}: #{key} must contain text." unless text?(row[key])
    end
    if text?(row['link'])
      errors << "#{label}: invalid link." unless link?(row['link'])
      errors << "#{label}: link_label is required with a link." unless text?(row['link_label'])
    elsif text?(row['link_label'])
      errors << "#{label}: link_label has no link."
    end
    identity = [row['date'], row['title']]
    errors << "#{label}: duplicate month and title." if seen[identity]
    seen[identity] = true
  end
rescue Psych::Exception, CSV::MalformedCSVError, ArgumentError, Errno::ENOENT => error
  errors << error.message
end

unless errors.empty?
  warn "MM1 data validation failed:\n#{errors.map { |error| "  * #{error}" }.join("\n")}"
  exit 1
end

puts "MM1 data valid: #{rows.length} milestones; current stage: #{steps[current - 1]}."
