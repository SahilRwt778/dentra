# Work around HTTP/2 framing errors from the CocoaPods CDN on this network.
# This affects only this process; installed gems and TLS verification stay unchanged.
require 'typhoeus'
module DentraHttp1Requests
  def initialize(url, options = {})
    super(url, options.merge(:http_version => :httpv1_1))
  end
end
Typhoeus::Request.prepend(DentraHttp1Requests)
load Gem.bin_path('cocoapods', 'pod')
