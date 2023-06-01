import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { Route53Client, ListResourceRecordSetsCommand, ChangeResourceRecordSetsCommand } from "@aws-sdk/client-route-53";

const clientConfig = { 
  region: Env.get('AWS_REGION'),
  credentials: {
    accessKeyId: Env.get('AWS_KEY'),
    secretAccessKey: Env.get('AWS_SECRET'),
  }
};

export default class Route53Service {
    constructor() {
  }

  async getDomainRecords(domain) {

    if (!domain) {
     return;
    }

    const client = new Route53Client(clientConfig);

    const input = {
      HostedZoneId: Env.get('AWS_ETH_XYZ_HOSTED_ZONE_ID'),
      StartRecordName: domain,
      StartRecordType: 'TXT',
      MaxItems: 10,
    };
    const command = new ListResourceRecordSetsCommand(input);

    const response = await client.send(command);

    return response;

  }


  async setDomainRecord(txtKey, txtValue) {
    let domainRecords = await this.getDomainRecords(txtKey);

    let domainRecordExists = domainRecords && domainRecords.ResourceRecordSets && domainRecords.ResourceRecordSets.length > 0;

    if(!domainRecordExists && !txtKey) {
      return;
    }

    //@ts-ignore
    if(domainRecordExists) {
      // @ts-ignore
      let record = domainRecords.ResourceRecordSets.find((record) => {
        return record.Name === txtKey;
      });

      if(record && !txtValue) {
        // record exists but shouldnt, delete it
        // @ts-ignore
        this.setRecord(txtKey, record.ResourceRecords[0].Value, 'DELETE');
        return;
      }

      // @ts-ignore
      if(record.ResourceRecords && record.ResourceRecords.length > 0 && record.ResourceRecords[0].Value === `"${txtValue}"`) {
        // record exists, no need to update 
        return;
      }else{
        // record is different, recreate it
        this.setRecord(txtKey, txtValue);
      }

    }else{
      if(txtValue) {
        // record does not exists, create it
        this.setRecord(txtKey, txtValue);
      }
    }
  }

  async setRecord(txtKey, txtValue, action = 'UPSERT') {
    const client = new Route53Client(clientConfig);

    // remove double quotes if so returned by the api
    if(txtValue && txtValue[0] == '"' && txtValue[txtValue.length - 1] == '"'){
      txtValue = txtValue.substring(1, txtValue.length-1);
   }

    const input = {
      HostedZoneId: Env.get('AWS_ETH_XYZ_HOSTED_ZONE_ID'),
      ChangeBatch: {
        Changes: [
          {
            Action: action,
            ResourceRecordSet: {
              Name: txtKey,
              Type: 'TXT',
              TTL: 300,
              ResourceRecords: [
                {
                  Value: `"${txtValue}"`,
                },
              ],
            },
          },
        ],
      },
    };

    const command = new ChangeResourceRecordSetsCommand(input);

    return await client.send(command);
  }
}
