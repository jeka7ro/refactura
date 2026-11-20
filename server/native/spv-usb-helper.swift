import Foundation
import Security

struct HelperInput: Decodable {
  let cif: String
  let zile: Int?
  let existingIds: [String]?
}

struct DownloadedItem: Encodable {
  let anafId: String
  let cif: String
  let tip: String
  let idSolicitare: String?
  let dataCreare: String
  let detalii: String
  let fileBase64: String
  let contentType: String
  let originalFileName: String
}

struct HelperOutput: Encodable {
  let ok: Bool
  let noStickFound: Bool?
  let wrongCertificate: Bool?
  let certSubject: String?
  let allowedCifs: [String]?
  let rawTotal: Int?
  let matchedTotal: Int?
  let alreadySaved: Int?
  let failed: Int?
  let zileUsed: Int?
  let emptyNotice: String?
  let lastError: String?
  let error: String?
  let items: [DownloadedItem]?
}

struct CertSummary: Encodable {
  let summary: String
}

struct ListCertsOutput: Encodable {
  let ok: Bool
  let certs: [CertSummary]
}

let eFacturaTips: Set<String> = [
  "FACTURA PRIMITA",
  "FACTURA TRIMISA",
  "ERORI FACTURA",
]

func normalizeCif(_ value: String?) -> String {
  let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.lowercased().hasPrefix("ro") {
    return String(trimmed.dropFirst(2)).trimmingCharacters(in: .whitespacesAndNewlines)
  }
  return trimmed
}

func emitJson<T: Encodable>(_ payload: T) {
  let encoder = JSONEncoder()
  if let data = try? encoder.encode(payload),
     let text = String(data: data, encoding: .utf8) {
    print(text)
    fflush(stdout)
  }
}

func isQualifiedSmartcardIdentity(_ identity: SecIdentity) -> (qualified: Bool, summary: String, cert: SecCertificate?) {
  var cert: SecCertificate?
  SecIdentityCopyCertificate(identity, &cert)
  guard let certificate = cert else {
    return (false, "", nil)
  }
  let summary = (SecCertificateCopySubjectSummary(certificate) as String?) ?? ""
  let lowerSummary = summary.lowercased()
  let excluded = ["apple configurator", "macbook", "localhost", "apple development"]
  if excluded.contains(where: { lowerSummary.contains($0) }) {
    return (false, summary, certificate)
  }
  let der = SecCertificateCopyData(certificate) as Data
  let latin1 = String(data: der, encoding: .isoLatin1) ?? ""
  let markers = [
    "DigiSign",
    "certSIGN",
    "Trans Sped",
    "TransSped",
    "AlfaTrust",
    "Namirial",
    "AloSign",
    "Certificat Calificat",
  ]
  if markers.contains(where: { latin1.contains($0) }) {
    return (true, summary, certificate)
  }
  return (false, summary, certificate)
}

func loadQualifiedIdentities() -> [(identity: SecIdentity, summary: String, cert: SecCertificate)] {
  let query: [String: Any] = [
    kSecClass as String: kSecClassIdentity,
    kSecMatchLimit as String: kSecMatchLimitAll,
    kSecReturnRef as String: true,
  ]
  var rawResult: CFTypeRef?
  let status = SecItemCopyMatching(query as CFDictionary, &rawResult)
  guard status == errSecSuccess, let identities = rawResult as? [SecIdentity] else {
    return []
  }
  var result: [(SecIdentity, String, SecCertificate)] = []
  for id in identities {
    let info = isQualifiedSmartcardIdentity(id)
    if info.qualified, let cert = info.cert {
      result.append((id, info.summary, cert))
    }
  }
  return result
}

func parseContentDispositionFilename(_ disp: String) -> String {
  let utf8Pattern = #"filename\*=UTF-8''([^;]+)"#
  if let regex = try? NSRegularExpression(pattern: utf8Pattern, options: .caseInsensitive),
     let match = regex.firstMatch(in: disp, range: NSRange(disp.startIndex..., in: disp)),
     let range = Range(match.range(at: 1), in: disp) {
    let raw = String(disp[range]).trimmingCharacters(in: .whitespacesAndNewlines)
    return raw.removingPercentEncoding ?? raw
  }

  let plainPattern = #"filename="?([^";]+)"?"#
  if let regex = try? NSRegularExpression(pattern: plainPattern, options: .caseInsensitive),
     let match = regex.firstMatch(in: disp, range: NSRange(disp.startIndex..., in: disp)),
     let range = Range(match.range(at: 1), in: disp) {
    return String(disp[range]).trimmingCharacters(in: .whitespacesAndNewlines)
  }
  return ""
}

func formEncode(_ items: [(String, String)]) -> Data {
  var allowed = CharacterSet.alphanumerics
  allowed.insert(charactersIn: "-._*")
  let pairs = items.map { pair -> String in
    let k = pair.0.addingPercentEncoding(withAllowedCharacters: allowed) ?? pair.0
    let v = pair.1.addingPercentEncoding(withAllowedCharacters: allowed) ?? pair.1
    return "\(k)=\(v)"
  }
  return pairs.joined(separator: "&").data(using: .utf8) ?? Data()
}

func extractHtmlForm(from html: String) -> (action: String, fields: [(String, String)])? {
  guard html.range(of: "<form", options: .caseInsensitive) != nil else {
    return nil
  }
  var action = "/my.policy"
  if let actionRegex = try? NSRegularExpression(
    pattern: #"<form[^>]*action\s*=\s*["']?([^"'\s>]+)["']?"#,
    options: .caseInsensitive
  ),
     let match = actionRegex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
     let range = Range(match.range(at: 1), in: html) {
    action = String(html[range])
  }

  var fields: [(String, String)] = []
  if let inputRegex = try? NSRegularExpression(
    pattern: #"<input[^>]+>"#,
    options: .caseInsensitive
  ) {
    let matches = inputRegex.matches(in: html, range: NSRange(html.startIndex..., in: html))
    let nameRegex = try? NSRegularExpression(pattern: #"name\s*=\s*["']([^"']+)["']"#, options: .caseInsensitive)
    let valRegex = try? NSRegularExpression(pattern: #"value\s*=\s*["']([^"']*)["']"#, options: .caseInsensitive)
    for m in matches {
      guard let r = Range(m.range, in: html) else { continue }
      let tag = String(html[r])
      var nameVal: String?
      if let nm = nameRegex?.firstMatch(in: tag, range: NSRange(tag.startIndex..., in: tag)),
         let nr = Range(nm.range(at: 1), in: tag) {
        nameVal = String(tag[nr])
      }
      if let name = nameVal {
        var value = ""
        if let vm = valRegex?.firstMatch(in: tag, range: NSRange(tag.startIndex..., in: tag)),
           let vr = Range(vm.range(at: 1), in: tag) {
          value = String(tag[vr])
        }
        fields.append((name, value))
      }
    }
  }
  return (action, fields)
}

final class AnafMtlsClient: NSObject, URLSessionDelegate, URLSessionTaskDelegate {
  private let identity: SecIdentity
  private let cert: SecCertificate
  private lazy var session: URLSession = {
    let cfg = URLSessionConfiguration.ephemeral
    cfg.requestCachePolicy = .reloadIgnoringLocalCacheData
    cfg.urlCache = nil
    cfg.timeoutIntervalForRequest = 35
    cfg.timeoutIntervalForResource = 60
    return URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
  }()

  init(identity: SecIdentity, cert: SecCertificate) {
    self.identity = identity
    self.cert = cert
    super.init()
  }

  func invalidate() {
    session.invalidateAndCancel()
  }

  private func handleChallenge(
    _ challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    let method = challenge.protectionSpace.authenticationMethod
    if method == NSURLAuthenticationMethodClientCertificate {
      let cred = URLCredential(identity: identity, certificates: [cert], persistence: .forSession)
      completionHandler(.useCredential, cred)
      return
    }
    if method == NSURLAuthenticationMethodServerTrust,
       let serverTrust = challenge.protectionSpace.serverTrust {
      let host = challenge.protectionSpace.host.lowercased()
      if host == "webserviced.anaf.ro" || host.hasSuffix(".anaf.ro") {
        var err: CFError?
        if SecTrustEvaluateWithError(serverTrust, &err) {
          completionHandler(.useCredential, URLCredential(trust: serverTrust))
          return
        }
      }
    }
    completionHandler(.performDefaultHandling, nil)
  }

  func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    handleChallenge(challenge, completionHandler: completionHandler)
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    handleChallenge(challenge, completionHandler: completionHandler)
  }

  func request(
    _ urlString: String,
    method: String = "GET",
    formBody: [(String, String)]? = nil,
    clientlessHeader: Bool = true
  ) -> (data: Data, statusCode: Int, headers: [AnyHashable: Any], finalUrl: String, error: String?) {
    guard let url = URL(string: urlString) else {
      return (Data(), 0, [:], urlString, "URL invalid: \(urlString)")
    }

    var req = URLRequest(url: url)
    req.httpMethod = method
    req.cachePolicy = .reloadIgnoringLocalCacheData
    if clientlessHeader {
      req.setValue("1", forHTTPHeaderField: "Clientless-Mode")
    }
    if let bodyItems = formBody {
      req.httpBody = formEncode(bodyItems)
      req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    }

    let sem = DispatchSemaphore(value: 0)
    var outData = Data()
    var outStatus = 0
    var outHeaders: [AnyHashable: Any] = [:]
    var outFinalUrl = urlString
    var outError: String?

    let task = session.dataTask(with: req) { data, resp, err in
      if let err = err {
        outError = err.localizedDescription
      }
      if let d = data {
        outData = d
      }
      if let http = resp as? HTTPURLResponse {
        outStatus = http.statusCode
        outHeaders = http.allHeaderFields
        if let finalU = http.url?.absoluteString {
          outFinalUrl = finalU
        }
      }
      sem.signal()
    }
    task.resume()

    if sem.wait(timeout: .now() + 45) == .timedOut {
      task.cancel()
      return (Data(), 0, [:], outFinalUrl, "Timeout la conectarea cu webserviced.anaf.ro")
    }

    return (outData, outStatus, outHeaders, outFinalUrl, outError)
  }

  func fetchListJson(zile: Int) -> (json: [String: Any]?, zileUsed: Int, error: String?) {
    let candidates = Array(Set([zile, 59, 50])).filter { $0 <= zile && $0 > 0 }.sorted(by: >)
    for days in candidates {
      let url = "https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=\(days)"
      var res = request(url, method: "GET", clientlessHeader: true)

      if res.error != nil && res.data.isEmpty {
        return (nil, days, res.error)
      }

      if let bodyText = String(data: res.data, encoding: .utf8),
         !bodyText.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("{") {
        if let form = extractHtmlForm(from: bodyText) {
          let actionUrl = form.action.hasPrefix("http")
            ? form.action
            : "https://webserviced.anaf.ro\(form.action.hasPrefix("/") ? "" : "/")\(form.action)"
          _ = request(actionUrl, method: "POST", formBody: form.fields, clientlessHeader: false)
          res = request(url, method: "GET", clientlessHeader: true)
        } else if res.finalUrl.contains("/my.policy") || res.finalUrl.contains("/vdesk/hangup") {
          res = request(url, method: "GET", clientlessHeader: false)
        }
      }

      guard let parsed = (try? JSONSerialization.jsonObject(with: res.data)) as? [String: Any] else {
        if let txt = String(data: res.data, encoding: .utf8) {
          let low = txt.lowercased()
          if low.contains("session could not be established") || low.contains("access was denied") {
            return (nil, days, "ANAF a inchis sesiunea F5 APM. Verifica stick-ul USB si PIN-ul.")
          }
        }
        return (nil, days, "Raspuns invalid primit de la webserviced.anaf.ro (HTTP \(res.statusCode)).")
      }

      if let errMsg = parsed["eroare"] as? String,
         errMsg.lowercased().contains("zile"),
         days != candidates.last {
        continue
      }

      return (parsed, days, nil)
    }

    return (nil, zile, "Nu s-a putut citi lista SPV ANAF.")
  }

  func downloadDocument(id: String) -> (ok: Bool, base64: String?, contentType: String, fileName: String, error: String?) {
    let encodedId = id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? id
    let url = "https://webserviced.anaf.ro/SPVWS2/rest/descarcare?id=\(encodedId)"
    let res = request(url, method: "GET", clientlessHeader: true)

    if res.statusCode != 200 || res.data.isEmpty {
      return (false, nil, "", "", res.error ?? "ANAF a returnat HTTP \(res.statusCode) pentru documentul \(id).")
    }

    let contentType = (res.headers["Content-Type"] as? String)
      ?? (res.headers["content-type"] as? String)
      ?? ""
    let disp = (res.headers["Content-Disposition"] as? String)
      ?? (res.headers["content-disposition"] as? String)
      ?? ""
    let fileName = parseContentDispositionFilename(disp)

    let firstNonWs = res.data.prefix(64).first(where: { $0 > 32 }) ?? 0
    if contentType.lowercased().contains("json") || firstNonWs == 123 {
      if let obj = (try? JSONSerialization.jsonObject(with: res.data)) as? [String: Any],
         let jsonErr = obj["eroare"] as? String {
        return (false, nil, contentType, fileName, jsonErr)
      }
      return (false, nil, contentType, fileName, "ANAF a returnat un raspuns neasteptat pentru documentul \(id).")
    }

    return (true, res.data.base64EncodedString(), contentType, fileName, nil)
  }
}

func runMain() {
  let args = CommandLine.arguments
  let qualified = loadQualifiedIdentities()

  if args.contains("--list-certs") {
    let certs = qualified.map { CertSummary(summary: $0.summary) }
    emitJson(ListCertsOutput(ok: true, certs: certs))
    return
  }

  let stdinData = FileHandle.standardInput.readDataToEndOfFile()
  guard let input = try? JSONDecoder().decode(HelperInput.self, from: stdinData) else {
    emitJson(HelperOutput(
      ok: false, noStickFound: nil, wrongCertificate: nil, certSubject: nil,
      allowedCifs: nil, rawTotal: nil, matchedTotal: nil, alreadySaved: nil,
      failed: nil, zileUsed: nil, emptyNotice: nil, lastError: nil,
      error: "Date de intrare invalide pentru helperul USB.", items: nil
    ))
    return
  }

  let targetCif = normalizeCif(input.cif)
  if targetCif.isEmpty {
    emitJson(HelperOutput(
      ok: false, noStickFound: nil, wrongCertificate: nil, certSubject: nil,
      allowedCifs: nil, rawTotal: nil, matchedTotal: nil, alreadySaved: nil,
      failed: nil, zileUsed: nil, emptyNotice: nil, lastError: nil,
      error: "Profilul activ nu are CUI / CNP configurat in Setari.", items: nil
    ))
    return
  }

  if qualified.isEmpty {
    emitJson(HelperOutput(
      ok: false, noStickFound: true, wrongCertificate: nil, certSubject: nil,
      allowedCifs: nil, rawTotal: nil, matchedTotal: nil, alreadySaved: nil,
      failed: nil, zileUsed: nil, emptyNotice: nil, lastError: nil,
      error: "Nu a fost detectat niciun certificat digital calificat pe stick-ul USB. Verifica daca stick-ul este introdus in Mac.",
      items: nil
    ))
    return
  }

  let zileReq = min(60, max(1, input.zile ?? 60))
  let existingSet = Set((input.existingIds ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) })

  var wrongCertResult: HelperOutput?
  var lastNetworkError: String?

  for candidate in qualified {
    let client = AnafMtlsClient(identity: candidate.identity, cert: candidate.cert)
    defer { client.invalidate() }

    let listRes = client.fetchListJson(zile: zileReq)
    guard let json = listRes.json else {
      lastNetworkError = listRes.error ?? "Nu s-a putut citi lista SPV ANAF."
      continue
    }

    var allowedSet = Set<String>()
    if let cnp = json["cnp"] as? String {
      let n = normalizeCif(cnp)
      if !n.isEmpty { allowedSet.insert(n) }
    }
    if let cuiStr = json["cui"] as? String {
      for part in cuiStr.split(separator: ",") {
        let n = normalizeCif(String(part))
        if !n.isEmpty { allowedSet.insert(n) }
      }
    }
    let allowedCifs = Array(allowedSet).sorted()

    if let errText = json["eroare"] as? String, !errText.isEmpty {
      if errText.lowercased().contains("nu exista mesaje") {
        if !allowedCifs.isEmpty && !allowedCifs.contains(targetCif) {
          wrongCertResult = HelperOutput(
            ok: false, noStickFound: false, wrongCertificate: true, certSubject: candidate.summary,
            allowedCifs: allowedCifs, rawTotal: 0, matchedTotal: 0, alreadySaved: 0,
            failed: 0, zileUsed: listRes.zileUsed, emptyNotice: nil, lastError: nil,
            error: "Stick-ul USB introdus (\(candidate.summary)) are drepturi SPV pentru \(allowedCifs.joined(separator: ", ")), nu pentru \(targetCif).",
            items: nil
          )
          continue
        }
        emitJson(HelperOutput(
          ok: true, noStickFound: false, wrongCertificate: false, certSubject: candidate.summary,
          allowedCifs: allowedCifs, rawTotal: 0, matchedTotal: 0, alreadySaved: 0,
          failed: 0, zileUsed: listRes.zileUsed, emptyNotice: errText, lastError: nil,
          error: nil, items: []
        ))
        return
      }
      lastNetworkError = errText
      continue
    }

    let rawMessages = (json["mesaje"] as? [[String: Any]]) ?? []
    let matched = rawMessages.filter { m in
      let msgCif = normalizeCif((m["cif"] as? String) ?? (m["cnp"] as? String) ?? (m["cui"] as? String))
      let detalii = (m["detalii"] as? String) ?? ""
      let tipUpper = ((m["tip"] as? String) ?? "").uppercased().trimmingCharacters(in: .whitespacesAndNewlines)
      let matchesTarget = msgCif == targetCif || (msgCif.isEmpty && detalii.contains(targetCif))
      return matchesTarget && !eFacturaTips.contains(tipUpper)
    }

    if matched.isEmpty && !allowedCifs.isEmpty && !allowedCifs.contains(targetCif) {
      wrongCertResult = HelperOutput(
        ok: false, noStickFound: false, wrongCertificate: true, certSubject: candidate.summary,
        allowedCifs: allowedCifs, rawTotal: rawMessages.count, matchedTotal: 0, alreadySaved: 0,
        failed: 0, zileUsed: listRes.zileUsed, emptyNotice: nil, lastError: nil,
        error: "Stick-ul USB introdus (\(candidate.summary)) are drepturi SPV pentru \(allowedCifs.joined(separator: ", ")), nu pentru \(targetCif).",
        items: nil
      )
      continue
    }

    let toDownload = matched.filter { m in
      let idVal = (m["id"] as? String) ?? (m["id"].map { "\($0)" } ?? "")
      return !idVal.isEmpty && !existingSet.contains(idVal)
    }
    let alreadySaved = matched.count - toDownload.count
    var downloadedItems: [DownloadedItem] = []
    var failedCount = 0
    var lastDlError: String?

    for m in toDownload {
      let msgId = (m["id"] as? String) ?? (m["id"].map { "\($0)" } ?? "")
      guard !msgId.isEmpty else { continue }
      let tipStr = (m["tip"] as? String) ?? "DOCUMENT"
      let solStr = (m["id_solicitare"] as? String) ?? (m["id_solicitare"].map { "\($0)" })
      let dataCreare = (m["data_creare"] as? String) ?? ""
      let detalii = (m["detalii"] as? String) ?? ""

      let dl = client.downloadDocument(id: msgId)
      if dl.ok, let b64 = dl.base64 {
        downloadedItems.append(DownloadedItem(
          anafId: msgId,
          cif: targetCif,
          tip: tipStr,
          idSolicitare: solStr,
          dataCreare: dataCreare,
          detalii: detalii,
          fileBase64: b64,
          contentType: dl.contentType,
          originalFileName: dl.fileName
        ))
      } else {
        failedCount += 1
        lastDlError = dl.error
      }
    }

    emitJson(HelperOutput(
      ok: true,
      noStickFound: false,
      wrongCertificate: false,
      certSubject: candidate.summary,
      allowedCifs: allowedCifs,
      rawTotal: rawMessages.count,
      matchedTotal: matched.count,
      alreadySaved: alreadySaved,
      failed: failedCount,
      zileUsed: listRes.zileUsed,
      emptyNotice: nil,
      lastError: lastDlError,
      error: nil,
      items: downloadedItems
    ))
    return
  }

  if let wrong = wrongCertResult {
    emitJson(wrong)
    return
  }

  emitJson(HelperOutput(
    ok: false, noStickFound: false, wrongCertificate: false, certSubject: nil,
    allowedCifs: nil, rawTotal: 0, matchedTotal: 0, alreadySaved: 0,
    failed: 0, zileUsed: zileReq, emptyNotice: nil, lastError: nil,
    error: lastNetworkError ?? "Nu s-a putut stabili conexiunea cu webserviced.anaf.ro folosind stick-ul USB.",
    items: nil
  ))
}

runMain()
