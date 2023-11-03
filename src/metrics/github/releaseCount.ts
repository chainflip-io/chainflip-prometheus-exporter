import promClient from "prom-client";
import { Context } from "../../lib/interfaces";
import { GithubConfig } from "../../config/interfaces";
import { AxiosInstance } from "axios"

const metricName: string = "github_repo_release";
const metric: promClient.Gauge = new promClient.Gauge({
  name: metricName,
  help: "Number or releases for a given repo",
  labelNames: ["repo"],
  registers: [],
});

export const releaseCount = async (context: Context) => {
  const { logger, registry, metricFailure, axiosInstance } = context;
  const config: GithubConfig = context.config as GithubConfig;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);

  for(const repository of config.repositories) {
    try {
      metricFailure.labels({ metric: metricName, repo: repository.repo }).set(0);
      const releases: number = await getReleases(
        logger,
        axiosInstance,
        repository.owner,
        repository.repo
      );
      metric.labels({ repo: repository.repo }).set(releases)
    } catch (err) {
      logger.error(err);
      metricFailure.labels({ metric: metricName, repo: repository.repo }).set(1);
    }
  }

};


async function getReleases(
  logger: any,
  axios: AxiosInstance,
  owner: string,
  repo: string
): Promise<number> {
  logger.debug(`Getting releases for ${owner}/${repo}`);

  try {
    let releaseCount: number = 0;
    let page = 1;
    let res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases`, {params: { per_page: 100}})

    releaseCount += res.data.length as number;
    while(res.data.length === 100) {
      page++;
      res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases`, {params: { per_page: 100, page}})
      releaseCount += res.data.length as number;
    }
    return releaseCount;
  } catch (err) {
    logger.error(err);
  }
  return 0;
}
